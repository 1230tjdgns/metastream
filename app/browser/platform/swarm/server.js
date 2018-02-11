import { NETWORK_TIMEOUT } from 'constants/network';
import { EncryptedSocket } from './socket'

const sodium = require('sodium-universal')
const discoverySwarm = require('discovery-swarm')
const swarmDefaults = require('dat-swarm-defaults')

const FRIENDSWARM = new Buffer('swarm3')

// +1 from Dat protocol default to reduce conflict
const DEFAULT_PORT = 3283

const SWARM_OPTS = {
  hash: false
}

// Get discovery key from original key
function getDiscoveryKey(tree) {
  var digest = new Buffer(32)
  sodium.crypto_generichash(digest, FRIENDSWARM, tree)
  // console.debug(`FRIENDDISC digest=${digest.toString('hex')}, tree=${tree.toString('hex')}`)
  return digest
}

function createSwarm(opts) {
  const swarm = discoverySwarm(swarmDefaults(SWARM_OPTS))
  swarm.listen(DEFAULT_PORT)
  swarm.join(opts.id, { announce: opts.announce ? opts.announce : true })

  swarm.on('error', function() {
    swarm.listen(0)
  })

  return swarm
}

async function authConnection(socket, opts) {
  return new Promise((resolve, reject) => {
    const esocket = new EncryptedSocket(socket, opts.publicKey, opts.secretKey)

    esocket.once('connection', () => {
      resolve(esocket)
    })
    esocket.once('error', (err) => {
      log(`Socket error: ${err}`)
      reject()
    })

    esocket.connect(opts.hostPublicKey)
  })
}

export function listen(opts, connectionHandler) {
  const discoveryKey = getDiscoveryKey(opts.publicKey)
  const swarm = createSwarm({ id: discoveryKey })

  // Wait for connections to perform auth handshake with
  swarm.on('connection', async socket => {
    const address = socket.address().address
    console.log('Local swarm connection', address)

    let esocket

    try {
      esocket = await authConnection(socket, {
        publicKey: opts.publicKey,
        secretKey: opts.secretKey
      })
    } catch (e) {
      console.error('Failed to auth peer\n', e)
      return
    }

    console.log(`AUTHED WITH PEER! ${address}`)

    // TODO: make sure handler closes socket
    connectionHandler(esocket, esocket.peerKey)
  })

  return swarm
}

export function connect(opts) {
  return new Promise((resolve, reject) => {
    let timeoutId, timeout
    const hostPublicKey = opts.hostPublicKey
    const discoveryKey = getDiscoveryKey(hostPublicKey)
    const swarm = createSwarm({ id: discoveryKey })

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      // TODO: will closing swarm also destroy socket?
      swarm.close()
    }

    // Wait for connections and attempt to auth with host
    swarm.on('connection', async socket => {
      console.log('Remote swarm connection', socket)

      const esocket = await authConnection(socket, {
        publicKey: opts.publicKey,
        secretKey: opts.secretKey,
        hostPublicKey
      })

      console.log(`AUTHED WITH HOST! ${socket.address().address}`)

      if (!timeout) {
        cleanup()
        resolve(esocket)
      }
    })

    timeoutId = setTimeout(() => {
      cleanup()
      timeout = true
      reject('Timeout connecting to swarm')
    }, NETWORK_TIMEOUT)
  })
}
