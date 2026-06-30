import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder } from "react-native";
import { MEMORY_WORLD, worldCenter } from "./world";
import type { MemoryCamera } from "./types";

type Point = {
  x: number;
  y: number;
};

type GestureState =
  | {
      mode: "pan";
      startPoint: Point;
      startCamera: MemoryCamera;
    }
  | {
      mode: "pinch";
      startDistance: number;
      startMidpoint: Point;
      startCamera: MemoryCamera;
    }
  | null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampCamera(
  camera: MemoryCamera,
  viewportWidth: number,
  viewportHeight: number
): MemoryCamera {
  const scale = clamp(camera.scale, MEMORY_WORLD.minScale, MEMORY_WORLD.maxScale);

  const visibleWidth = viewportWidth / scale;
  const visibleHeight = viewportHeight / scale;

  const x =
    visibleWidth >= MEMORY_WORLD.width
      ? (MEMORY_WORLD.width - visibleWidth) / 2
      : clamp(camera.x, 0, MEMORY_WORLD.width - visibleWidth);

  const y =
    visibleHeight >= MEMORY_WORLD.height
      ? (MEMORY_WORLD.height - visibleHeight) / 2
      : clamp(camera.y, 0, MEMORY_WORLD.height - visibleHeight);

  return {
    scale,
    x,
    y,
  };
}

function distance(a: Point, b: Point) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function midpoint(a: Point, b: Point): Point {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function getTouchPoint(touch: { locationX: number; locationY: number }): Point {
  return {
    x: touch.locationX,
    y: touch.locationY,
  };
}

export function useMemoryCamera(viewportWidth: number, viewportHeight: number) {
  const [camera, setCamera] = useState<MemoryCamera>(() =>
    clampCamera(
      {
        x: worldCenter.x - viewportWidth / MEMORY_WORLD.initialScale / 2,
        y: worldCenter.y - viewportHeight / MEMORY_WORLD.initialScale / 2,
        scale: MEMORY_WORLD.initialScale,
      },
      viewportWidth,
      viewportHeight
    )
  );

  const cameraRef = useRef(camera);
  const gestureRef = useRef<GestureState>(null);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  const commitCamera = (nextCamera: MemoryCamera) => {
    const clamped = clampCamera(nextCamera, viewportWidth, viewportHeight);
    cameraRef.current = clamped;
    setCamera(clamped);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,

        onPanResponderGrant: (event) => {
          const touches = event.nativeEvent.touches;

          if (touches.length >= 2) {
            const first = getTouchPoint(touches[0]);
            const second = getTouchPoint(touches[1]);

            gestureRef.current = {
              mode: "pinch",
              startDistance: distance(first, second),
              startMidpoint: midpoint(first, second),
              startCamera: cameraRef.current,
            };

            return;
          }

          if (touches.length === 1) {
            gestureRef.current = {
              mode: "pan",
              startPoint: getTouchPoint(touches[0]),
              startCamera: cameraRef.current,
            };
          }
        },

        onPanResponderMove: (event) => {
          const touches = event.nativeEvent.touches;

          if (touches.length >= 2) {
            const first = getTouchPoint(touches[0]);
            const second = getTouchPoint(touches[1]);
            const currentDistance = distance(first, second);
            const currentMidpoint = midpoint(first, second);

            if (!gestureRef.current || gestureRef.current.mode !== "pinch") {
              gestureRef.current = {
                mode: "pinch",
                startDistance: currentDistance,
                startMidpoint: currentMidpoint,
                startCamera: cameraRef.current,
              };
              return;
            }

            const start = gestureRef.current;
            const nextScale = clamp(
              start.startCamera.scale * (currentDistance / start.startDistance),
              MEMORY_WORLD.minScale,
              MEMORY_WORLD.maxScale
            );

            const worldFocalX =
              start.startCamera.x + start.startMidpoint.x / start.startCamera.scale;
            const worldFocalY =
              start.startCamera.y + start.startMidpoint.y / start.startCamera.scale;

            commitCamera({
              scale: nextScale,
              x: worldFocalX - currentMidpoint.x / nextScale,
              y: worldFocalY - currentMidpoint.y / nextScale,
            });

            return;
          }

          if (touches.length === 1) {
            const currentPoint = getTouchPoint(touches[0]);

            if (!gestureRef.current || gestureRef.current.mode !== "pan") {
              gestureRef.current = {
                mode: "pan",
                startPoint: currentPoint,
                startCamera: cameraRef.current,
              };
              return;
            }

            const start = gestureRef.current;
            const dx = currentPoint.x - start.startPoint.x;
            const dy = currentPoint.y - start.startPoint.y;

            commitCamera({
              ...start.startCamera,
              x: start.startCamera.x - dx / start.startCamera.scale,
              y: start.startCamera.y - dy / start.startCamera.scale,
            });
          }
        },

        onPanResponderRelease: () => {
          gestureRef.current = null;
        },

        onPanResponderTerminate: () => {
          gestureRef.current = null;
        },
      }),
    [viewportWidth, viewportHeight]
  );

  return {
    camera,
    panHandlers: panResponder.panHandlers,
  };
}