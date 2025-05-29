import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import { Holistic, POSE_CONNECTIONS } from "@mediapipe/holistic";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { Camera } from "@mediapipe/camera_utils";

const MPStart = () => {
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pointerPos, setPointerPos] = useState({ 
    x: window.innerWidth / 2, 
    y: window.innerHeight / 2
  });
  const [sensitivity, setSensitivity] = useState(15.0);
  const [completed, setCompleted] = useState(false);
  const [showCongrats, setShowCongrats] = useState(false);
  const velocity = useRef({ x: 0, y: 0 });
  const linkOpened = useRef(false);
  const inTriggerZone = useRef<string | null>(null);
  
  // Ссылки для каждой зоны
  const links = {
    'top-right': "https://github.com",
    'bottom-left': "https://google.com",
    'bottom-right': "https://youtube.com"
  };

  useEffect(() => {
    const holistic = new Holistic({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
    });

    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    holistic.onResults(onResults);

    let camera: Camera | null = null;

    if (webcamRef.current?.video) {
      camera = new Camera(webcamRef.current.video, {
        onFrame: async () => {
          await holistic.send({ image: webcamRef.current!.video! });
        },
        width: 640,
        height: 480,
      });
      camera.start();
    }

    const handleResize = () => {
      setPointerPos(prev => ({
        x: Math.min(prev.x, window.innerWidth),
        y: Math.min(prev.y, window.innerHeight)
      }));
    };

    window.addEventListener('resize', handleResize);

    return () => {
      camera?.stop();
      holistic.close();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const openLink = (url: string) => {
    if (!linkOpened.current) {
      window.open(url, "_blank");
      linkOpened.current = true;
      setTimeout(() => { linkOpened.current = false; }, 3000);
    }
  };

  const checkTriggerZone = (x: number, y: number) => {
    const triggerZones = [
      {
        id: 'top-right',
        x: window.innerWidth - 60,
        y: 60,
        radius: 40,
        action: () => openLink(links['top-right'])
      },
      {
        id: 'bottom-left',
        x: 60,
        y: window.innerHeight - 60,
        radius: 40,
        action: () => openLink(links['bottom-left'])
      },
      {
        id: 'bottom-right',
        x: window.innerWidth - 60,
        y: window.innerHeight - 60,
        radius: 40,
        action: () => {
          setCompleted(true);
          setShowCongrats(true);
          openLink(links['bottom-right']);
        }
      }
    ];

    for (const zone of triggerZones) {
      const dist = Math.sqrt(Math.pow(x - zone.x, 2) + Math.pow(y - zone.y, 2));
      if (dist < zone.radius) {
        if (inTriggerZone.current !== zone.id) {
          inTriggerZone.current = zone.id;
          setTimeout(() => {
            if (inTriggerZone.current === zone.id) {
              zone.action();
            }
          }, 800);
        }
        return;
      }
    }
    
    inTriggerZone.current = null;
  };

  const onResults = (results: any) => {
    if (!canvasRef.current) return;
    const canvasCtx = canvasRef.current.getContext("2d");
    if (!canvasCtx) return;

    canvasCtx.save();
    canvasCtx.scale(-1, 1);
    canvasCtx.translate(-canvasRef.current.width, 0);

    canvasCtx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    canvasCtx.drawImage(
      results.image,
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    if (results.poseLandmarks) {
      drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: "white",
      });
      drawLandmarks(canvasCtx, results.poseLandmarks, {
        color: "white",
        fillColor: "rgb(255,138,0)",
      });

      const leftShoulder = results.poseLandmarks[11];
      const leftWrist = results.poseLandmarks[15];

      if (leftWrist && leftShoulder) {
        const isLeftHandRaised = leftWrist.y < leftShoulder.y;

        if (isLeftHandRaised) {
          const currentX = leftWrist.x;
          const currentY = leftWrist.y;

          const deltaX = (0.5 - currentX) * window.innerWidth * sensitivity * 0.1;
          const deltaY = (currentY - 0.5) * window.innerHeight * sensitivity * 0.1;

          velocity.current = {
            x: velocity.current.x * 0.7 + deltaX * 0.3,
            y: velocity.current.y * 0.7 + deltaY * 0.3
          };

          const newX = Math.max(0, Math.min(pointerPos.x + velocity.current.x, window.innerWidth));
          const newY = Math.max(0, Math.min(pointerPos.y + velocity.current.y, window.innerHeight));

          setPointerPos({
            x: newX,
            y: newY
          });

          if (!completed) {
            checkTriggerZone(newX, newY);
          }
        } else {
          inTriggerZone.current = null;
        }
      } else {
        inTriggerZone.current = null;
      }
    }

    canvasCtx.restore();
  };

  const resetGame = () => {
    setCompleted(false);
    setShowCongrats(false);
    setPointerPos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, width: '100%', height: '100%' }}>
      {/* Слайдер для регулировки чувствительности */}
      <div style={{
        position: "absolute",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1002,
        background: "rgba(0,0,0,0.7)",
        padding: "10px",
        borderRadius: "5px",
        color: "white"
      }}>
        <label>
          Чувствительность: {sensitivity.toFixed(1)}
          <input
            type="range"
            min="1"
            max="10"
            step="0.1"
            value={sensitivity}
            onChange={(e) => setSensitivity(parseFloat(e.target.value))}
            style={{ width: "200px", marginLeft: "10px" }}
          />
        </label>
      </div>

      <canvas 
        ref={canvasRef} 
        width={640} 
        height={480}
        style={{ position: "absolute", top: "60px", left: "20px" }}
      >
        <Webcam audio={false} ref={webcamRef} />
      </canvas>
      
      {/* Красный указатель */}
      <div style={{
        position: "fixed",
        left: `${pointerPos.x}px`,
        top: `${pointerPos.y}px`,
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        background: inTriggerZone.current ? "#00ff00" : "red",
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
        zIndex: 1001,
        transition: "all 0.2s ease-out",
        boxShadow: inTriggerZone.current ? "0 0 10px #00ff00" : "0 0 5px rgba(0,0,0,0.5)"
      }}></div>
      
      {/* Зоны активации */}
      {/* 1. Правая верхняя зона */}
      <div style={{
        position: "fixed",
        right: "20px",
        top: "60px",
        width: "40px",
        height: "40px",
        border: `2px dashed ${inTriggerZone.current === 'top-right' ? '#00ff00' : 'red'}`,
        borderRadius: "50%",
        pointerEvents: "none",
        zIndex: 1000,
        background: "rgba(255,0,0,0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: inTriggerZone.current === 'top-right' ? '#00ff00' : 'red',
        fontSize: "10px",
        opacity: inTriggerZone.current === 'top-right' ? 1 : 0.5
      }}>
        {inTriggerZone.current === 'top-right' ? "✓" : "1"}
      </div>
      
      {/* 2. Левая нижняя зона */}
      <div style={{
        position: "fixed",
        left: "20px",
        bottom: "60px",
        width: "40px",
        height: "40px",
        border: `2px dashed ${inTriggerZone.current === 'bottom-left' ? '#00ff00' : 'red'}`,
        borderRadius: "50%",
        pointerEvents: "none",
        zIndex: 1000,
        background: "rgba(255,0,0,0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: inTriggerZone.current === 'bottom-left' ? '#00ff00' : 'red',
        fontSize: "10px",
        opacity: inTriggerZone.current === 'bottom-left' ? 1 : 0.5
      }}>
        {inTriggerZone.current === 'bottom-left' ? "✓" : "2"}
      </div>
      
      {/* 3. Правая нижняя зона */}
      <div style={{
        position: "fixed",
        right: "20px",
        bottom: "60px",
        width: "40px",
        height: "40px",
        border: `2px dashed ${inTriggerZone.current === 'bottom-right' ? '#00ff00' : 'red'}`,
        borderRadius: "50%",
        pointerEvents: "none",
        zIndex: 1000,
        background: "rgba(255,0,0,0.1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: inTriggerZone.current === 'bottom-right' ? '#00ff00' : 'red',
        fontSize: "10px",
        opacity: inTriggerZone.current === 'bottom-right' ? 1 : 0.5
      }}>
        {inTriggerZone.current === 'bottom-right' ? "✓" : "3"}
      </div>

      {/* Сообщение о завершении в центре экрана */}
      {showCongrats && (
        <div style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "rgba(0,0,0,0.8)",
          color: "white",
          padding: "30px",
          borderRadius: "15px",
          zIndex: 1003,
          textAlign: "center",
          fontSize: "28px",
          boxShadow: "0 0 20px rgba(0,255,0,0.5)",
          border: "2px solid #00ff00",
          animation: "fadeIn 0.5s ease"
        }}>
          Поздравляем! Вы активировали все точки! 🎉
          <div style={{ 
            marginTop: "20px", 
            fontSize: "18px",
            color: "#aaa"
          }}>
            (Активирована ссылка: {links['bottom-right']})
          </div>
          <div style={{ marginTop: "20px" }}>
            <button 
              onClick={resetGame}
              style={{
                padding: "10px 20px",
                background: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "16px",
                transition: "all 0.3s"
              }}
              onMouseOver={(e) => e.currentTarget.style.background = "#45a049"}
              onMouseOut={(e) => e.currentTarget.style.background = "#4CAF50"}
            >
              Начать заново
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MPStart;