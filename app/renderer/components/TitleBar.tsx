const { remote } = chrome;

import React, { Component } from 'react';

import * as packageJson from 'package.json';

import cx from 'classnames';
import styles from './TitleBar.css';
import { IconButton } from 'renderer/components/common/button';

interface IProps {
  className?: string;
  title?: string;
}

export class TitleBar extends Component<IProps> {
  private _platform: string;

  get window() {
    return remote.getCurrentWindow();
  }

  get platform() {
    return this._platform = this._platform || remote.require('os').platform();
  }

  render(): JSX.Element | null {
    return (
      <div className={cx(this.props.className, styles.container)}>
        <div className={styles.wrapper}>
          <header className={styles.header}>
            <h2 className={styles.title}>{this.props.title || packageJson.productName}</h2>
          </header>
          <IconButton icon="download" className={styles.updateButton}>Update</IconButton>
          {this.platform === 'win32' && this.renderWin32Actions()}
        </div>
      </div>
    );
  }

  private renderWin32Actions(): JSX.Element {
    const buttons = [
      {
        label: '0', // 🗕
        action: () => this.window.minimize()
      },
      {
        label: this.window.isMaximized() ? '2' : '1', // 🗖
        action: () => {
          if (this.window.isMaximized()) {
            this.window.restore();
          } else if (this.window.isMinimizable()) {
            this.window.maximize();
          }
          this.forceUpdate();
        }
      },
      {
        label: 'r', // ✕
        action: () => this.window.close()
      }
    ];

    return (
      <div className={styles.actions}>
        {buttons.map((btn, idx) => (
          <button key={idx} type="button" className={styles.actionButton} onClick={btn.action}>
            {btn.label}
          </button>
        ))}
      </div>
    );
  }
}
