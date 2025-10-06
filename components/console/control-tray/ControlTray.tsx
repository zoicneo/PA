/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import cn from 'classnames';

import { memo, ReactNode, useEffect, useRef, useState } from 'react';
import { AudioRecorder } from '../../../lib/audio-recorder';
import { useSettings, useTools, useLogStore } from '@/lib/state';

import { useLiveAPIContext } from '../../../contexts/LiveAPIContext';

const WaveformVisualizer = ({
  audioRecorder,
  isConnected,
}: {
  audioRecorder: AudioRecorder;
  isConnected: boolean;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isConnected) {
      const canvas = canvasRef.current;
      if (canvas) {
        const context = canvas.getContext('2d');
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    const draw = (dataArray: Uint8Array) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;

      const { width, height } = canvas;
      context.clearRect(0, 0, width, height);
      context.lineWidth = 2;
      context.strokeStyle = 'rgb(161, 228, 242)'; // var(--accent-blue)
      context.beginPath();

      const sliceWidth = (width * 1.0) / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        if (i === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
        x += sliceWidth;
      }

      context.lineTo(width, height / 2);
      context.stroke();
    };

    const handleWaveform = (dataArray: Uint8Array) => {
      draw(dataArray);
    };

    audioRecorder.on('waveform', handleWaveform);

    return () => {
      audioRecorder.off('waveform', handleWaveform);
    };
  }, [audioRecorder, isConnected]);

  if (!isConnected) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className="waveform-canvas"
      width="300"
      height="60"
    ></canvas>
  );
};

export type ControlTrayProps = {
  children?: ReactNode;
};

function ControlTray({ children }: ControlTrayProps) {
  const [audioRecorder] = useState(() => new AudioRecorder());
  const [muted, setMuted] = useState(false);
  const connectButtonRef = useRef<HTMLButtonElement>(null);

  const { client, connected, connect, disconnect } = useLiveAPIContext();

  useEffect(() => {
    // FIX: Cannot find name 'connectButton'. Did you mean 'connectButtonRef'?
    if (!connected && connectButtonRef.current) {
      // FIX: Cannot find name 'connectButton'. Did you mean 'connectButtonRef'?
      connectButtonRef.current.focus();
    }
  }, [connected]);

  useEffect(() => {
    if (!connected) {
      setMuted(false);
    }
  }, [connected]);

  useEffect(() => {
    const onData = (base64: string) => {
      client.sendRealtimeInput([
        {
          mimeType: 'audio/pcm;rate=16000',
          data: base64,
        },
      ]);
    };
    if (connected && !muted && audioRecorder) {
      audioRecorder.on('data', onData);
      audioRecorder.start();
    } else {
      audioRecorder.stop();
    }
    return () => {
      audioRecorder.off('data', onData);
    };
  }, [connected, client, muted, audioRecorder]);

  const handleMicClick = () => {
    if (connected) {
      setMuted(!muted);
    } else {
      connect();
    }
  };

  const handleExportLogs = () => {
    const { systemPrompt, model } = useSettings.getState();
    const { tools } = useTools.getState();
    const { turns } = useLogStore.getState();

    const logData = {
      configuration: {
        model,
        systemPrompt,
      },
      tools,
      conversation: turns.map(turn => ({
        ...turn,
        // Convert Date object to ISO string for JSON serialization
        timestamp: turn.timestamp.toISOString(),
      })),
    };

    const jsonString = JSON.stringify(logData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `live-api-logs-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const micButtonTitle = connected
    ? muted
      ? 'Unmute microphone'
      : 'Mute microphone'
    : 'Connect and start microphone';

  const connectButtonTitle = connected ? 'Stop streaming' : 'Start streaming';

  return (
    <section className="control-tray">
      <WaveformVisualizer audioRecorder={audioRecorder} isConnected={connected} />
      <div className="control-tray-actions">
        <nav className={cn('actions-nav')}>
          <button
            className={cn('action-button mic-button')}
            onClick={handleMicClick}
            title={micButtonTitle}
          >
            {!muted ? (
              <span className="material-symbols-outlined filled">mic</span>
            ) : (
              <span className="material-symbols-outlined filled">mic_off</span>
            )}
          </button>
          <button
            className={cn('action-button')}
            onClick={handleExportLogs}
            aria-label="Export Logs"
            title="Export session logs"
          >
            <span className="icon">download</span>
          </button>
          <button
            className={cn('action-button')}
            onClick={useLogStore.getState().clearTurns}
            aria-label="Reset Chat"
            title="Reset session logs"
          >
            <span className="icon">refresh</span>
          </button>
          {children}
        </nav>

        <div className={cn('connection-container', { connected })}>
          <div className="connection-button-container">
            <button
              ref={connectButtonRef}
              className={cn('action-button connect-toggle', { connected })}
              onClick={connected ? disconnect : connect}
              title={connectButtonTitle}
            >
              <span className="material-symbols-outlined filled">
                {connected ? 'pause' : 'play_arrow'}
              </span>
            </button>
          </div>
          <span className="text-indicator">Streaming</span>
        </div>
      </div>
    </section>
  );
}

export default memo(ControlTray);