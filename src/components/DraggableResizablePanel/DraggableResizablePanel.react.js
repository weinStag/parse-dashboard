/*
 * Copyright (c) 2016-present, Parse, LLC
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */
import React, { useState, useRef, useEffect } from 'react';
import { ResizableBox } from 'react-resizable';
import Icon from 'components/Icon/Icon.react';
import styles from './DraggableResizablePanel.scss';

const DraggableResizablePanel = ({
  children,
  width = 400,
  height = 400,
  minWidth = 300,
  maxWidth = 800,
  minHeight = 300,
  maxHeight = 600,
  title = "Panel",
  onClose,
  initialPosition = { x: 100, y: 100 }
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [size, setSize] = useState({ width, height });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const panelRef = useRef(null);
  const titleBarRef = useRef(null);  const handleMouseDown = (e) => {
    // Verificar se o clique foi na barra de título ou seus filhos
    if (titleBarRef.current && (
      e.target === titleBarRef.current ||
      titleBarRef.current.contains(e.target)
    )) {

      // Verificar se não clicou no botão fechar
      if (!e.target.closest('[data-close-button="true"]')) {
        setIsDragging(true);
        setDragStart({
          x: e.clientX - position.x,
          y: e.clientY - position.y
        });
        e.preventDefault();
        e.stopPropagation();
      }
    }
  };  const handleMouseMove = (e) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // Limitar a posição para não sair da tela
      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - size.height;

      const newPosition = {
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      };

      setPosition(newPosition);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleResize = (event, { size: newSize }) => {
    setSize(newSize);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'move';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragStart, position, size]);

  return (
    <div
      ref={panelRef}
      className={styles.draggablePanel}
      style={{
        left: position.x,
        top: position.y,
        zIndex: 1000
      }}
    >
      <ResizableBox
        width={size.width}
        height={size.height}
        minConstraints={[minWidth, minHeight]}
        maxConstraints={[maxWidth, maxHeight]}
        onResize={handleResize}
        resizeHandles={['se', 'e', 's', 'w', 'n', 'ne', 'nw', 'sw']}
        className={styles.resizableContainer}
      >
        <div className={styles.panelContainer}>
          {/* Barra de título */}
          <div
            ref={titleBarRef}
            className={styles.titleBar}
            onMouseDown={handleMouseDown}
          >
            <div className={styles.title}>
              <Icon width={16} height={16} fill="currentColor" name="analytics-outline" />
              <span>{title}</span>
            </div>
            <div className={styles.controls}>
              <button
                className={styles.closeButton}
                onClick={onClose}
                title="Close Panel"
                data-close-button="true"
              >
                <Icon width={14} height={14} fill="currentColor" name="x-outline" />
              </button>
            </div>
          </div>

          {/* Conteúdo do painel */}
          <div className={styles.content}>
            {children}
          </div>
        </div>
      </ResizableBox>
    </div>
  );
};

export default DraggableResizablePanel;
