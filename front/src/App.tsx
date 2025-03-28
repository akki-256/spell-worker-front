import { useEffect, useRef, useState } from 'react'
import ReconnectingWebSocket from 'reconnecting-websocket'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition'
import setServer from './component/setServer'
import setUpSpell from './component/setUpSpell'
import useSound from 'use-sound'
import defaultAlarmSound from '../default-alarm-sound.mp3'
import { captureAndSendPY } from './component/captureandsend'
import wandImage from "../public/SpellWorker Wand.svg";
import "../src/App.css";
import "@fontsource/MedievalSharp";
import { RxCross2 } from "react-icons/rx";
import { PiPlayBold } from "react-icons/pi";
import { TbPlayerPause } from "react-icons/tb";
import { motion, AnimatePresence } from "framer-motion";

const NITRO_SPELLSUCCESS_URL = 'ws://localhost:3000/spell'
const NITRO_SETUP_SPELL_URL = 'ws://localhost:3000/setup'
const NITRO_HANDLING_URL = 'http://localhost:3000/sse'
const PYTHON_SLEEP_URL = 'http://localhost:8000/analyze'
const N_OF_USED_SPELL = 4

const settimer = ((count: number) => {
  let h = Math.floor(count / 3600).toString().padStart(2, '0')
  let m = Math.floor((count / 60) % 60).toString().padStart(2, '0')
  let s = Math.floor(count % 60).toString().padStart(2, '0')
  return [h, m, s]
});

export const usedSpell = setUpSpell(2)//#########ToDo########### 本来は魔法の種類だけある

type nitroResType = {
  "user": string,
  "message": string | nitrosMessageType
}

type nitrosMessageType = {
  "magicSuccess": string | null,
  "isMoving": boolean
}

interface ImageStyle {
  width: string;
  height: string;
  top: string;
  left: string;
  transform: string;
  opacity: number;
  zIndex: number;
}

interface DisplayImage {
  url: string;
  style: ImageStyle;
}

const App = () => {
  const [counter, setCounter] = useState(0)//カウントアップ用
  const stopCounter = useRef(-1)
  // const [nitroRes, setnitroRes] = useState<string>('{"user":"default","message":"default"}')
  const [nitroRes, setnitroRes] = useState<nitroResType>({ "user": "default", "message": "default" })
  const [pyRes, setPyres] = useState("False")
  const nitroSocketRef = useRef<ReconnectingWebSocket>(null)//webSocket使用用
  const [handling, setHandling] = useState<string>('false')
  const [dispState, setDispState] = useState<string>('title')
  const videoRef = useRef<HTMLVideoElement | null>(document.createElement('video'))
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas'))
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const {
    finalTranscript,
    browserSupportsSpeechRecognition,
    resetTranscript,
    isMicrophoneAvailable,
  } = useSpeechRecognition();//音声テキスト化API
  const [play, { stop, sound }] = useSound(defaultAlarmSound, {
    playbackRate: 1.0, // 標準の再生速度
    volume: 10,
    interrupt: true,
    loop: true
  })

  // const captureFrame = async () => {
  //   if (!videoRef.current) return;
  //   if (!canvasRef.current) return;

  //   canvasRef.current.width = videoRef.current.videoWidth
  //   canvasRef.current.height = videoRef.current.videoHeight
  //   const ctx = ctxRef.current ?? canvasRef.current.getContext("2d");
  //   if (!ctx) return;
  //   ctxRef.current = ctx;
  //   ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);

  //   const blob = await new Promise<Blob | null>((resolve) => {
  //     canvasRef.current.toBlob((b) => resolve(b), 'image/jpeg')
  //   })
  //   if (blob) {
  //     sendPy(PYTHON_SLEEP_URL, blob).then(respons => {
  //       if (typeof (respons) == 'string') setPyres(respons)
  //     })
  //   }
  // };

  const stopCount = () => {
    stopCounter.current = counter
  }
  const startCount = () => {
    setCounter(stopCounter.current)
    stopCounter.current = -1
  }
  const stopalerm = () => {
    stop()
    setDispState('work')
  }

  //初回レンダリング時
  useEffect(() => {
    SpeechRecognition.startListening({ continuous: true, language: 'ja' })//音声テキスト化の有効化
    nitroSocketRef.current = setServer(NITRO_SPELLSUCCESS_URL, setnitroRes)
    const handlingSSE = new EventSource(NITRO_HANDLING_URL)
    handlingSSE.onmessage = (event) => setHandling(event.data)
    const sendUsedSpell = setServer(NITRO_SETUP_SPELL_URL)
    sendUsedSpell.send(JSON.stringify(usedSpell))

    let stream: MediaStream;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((s) => {
        stream = s
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play()
        }
      })

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      SpeechRecognition.stopListening()
    };
  }, [])

  useEffect(() => {
    if (finalTranscript !== '' && nitroSocketRef.current?.readyState === WebSocket.OPEN) {
      const sendMessage = finalTranscript.replace(/\s+/g, '')
      nitroSocketRef.current?.send(sendMessage)
      resetTranscript();
    } else if (nitroSocketRef.current?.readyState !== WebSocket.OPEN) {
      nitroSocketRef.current?.reconnect()
    } else if (dispState === 'start' && handling === 'true' && finalTranscript.includes('か')) {
      //タイトルをクリックした後、杖を振って魔法を言ったらwork画面に移行{
      setDispState('work')
      const interval = setInterval(() => {
        setCounter(prev => prev + 1);
        captureAndSendPY(videoRef, canvasRef, ctxRef, PYTHON_SLEEP_URL, setPyres)
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [finalTranscript])

  useEffect(() => {
    console.log('nitroRes', nitroRes)
    if ((nitroRes.message as nitrosMessageType)?.magicSuccess) {
      console.log('magicSuccess', (nitroRes.message as nitrosMessageType)?.magicSuccess)
      switch ((nitroRes.message as nitrosMessageType)?.magicSuccess) {
        case 'void1': window.location.reload()
          break
        case 'void2': stopCount()
          break
        case 'void3': startCount()
          break
        case 'void4':
          if (sound.isPlayng) stopalerm()
          break
      }
      // if ((nitroRes?.message as nitrosMessageType)?.magicSuccess === 'void1') {
      //   window.location.reload()
      // } else if ((nitroRes?.message as nitrosMessageType)?.magicSuccess === 'void2') {
      //   stopCount()
      // } else if ((nitroRes?.message as nitrosMessageType)?.magicSuccess === 'void3') {
      //   startCount()
      // } else if ((nitroRes?.message as nitrosMessageType)?.magicSuccess === 'void4' && sound?.isPlayng) {
      //   stopalerm()
      // }
    }
  }, [nitroRes])

  useEffect(() => {
    if (pyRes === "True") {
      setDispState('sleep')
      shuffleImages();
      if (sound) play()
    }
  }, [pyRes])

  //画像の設定 
  const images = ["/img1.svg", "/img2.svg", "/img3.svg", "/img4.svg", "/img5.svg", "/img6.svg"];
  const [displayImages, setDisplayImages] = useState<DisplayImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [imageError, setImageError] = useState<boolean>(false);

  //画像の配置
  const generateGridPositions = (count: number): ImageStyle[] => {
    const styles: ImageStyle[] = [];
    const size = 40;
    const padding = 0;

    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    const totalWidthSpace = 100 - (size + padding * 2);
    const totalHeightSpace = 100 - (size + padding * 2);

    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      let left = (totalWidthSpace / (cols - 1)) * col;
      let top = (totalHeightSpace / (rows - 1)) * row;

      const jitter = 5;
      left += Math.random() * jitter - jitter / 2;
      top += Math.random() * jitter - jitter / 2;

      left = Math.max(padding, Math.min(100 - size - padding, left));
      top = Math.max(padding, Math.min(100 - size - padding, top));

      const rotation = Math.random() * 10 - 5;

      styles.push({
        width: `${size}%`,
        height: `${size}%`,
        top: `${top}%`,
        left: `${left}%`,
        transform: `rotate(${rotation}deg)`,
        opacity: 1,
        zIndex: 1
      });
    }

    return styles;
  };
// 画像の変更
  const shuffleImages = () => {
    setImageError(false);
    setDisplayImages(prev =>
      prev.map(img => ({
        ...img,
        style: { ...img.style, opacity: 0 }
      }))
    );

    setTimeout(() => {
      const randomImageIndex = Math.floor(Math.random() * images.length);
      const newSelectedImage = images[randomImageIndex];
      setSelectedImage(newSelectedImage);

      const numberOfImages = Math.floor(Math.random() * 2) + 9;
      const gridPositions = generateGridPositions(numberOfImages);

      const newImages: DisplayImage[] = [];

      for (let i = 0; i < numberOfImages; i++) {
        newImages.push({
          url: newSelectedImage,
          style: { ...gridPositions[i], opacity: 0 }
        });
      }

      setDisplayImages(newImages);

      requestAnimationFrame(() => {
        setDisplayImages(newImages.map(img => ({
          ...img,
          style: { ...img.style, opacity: 1 }
        })));
      });
    }, 300);
  };

  const handleImageError = () => {
    setImageError(true);
    console.error('Failed to load image:', selectedImage);
  };

  // アニメーション
  const pageFade = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.5 } },
    exit: { opacity: 0, transition: { duration: 0.5 } },
  };

  const slideUpDown = {
    initial: { y: "100%" },
    animate: { y: 0 , transition: { duration: 0.5 } },
    exit: { y: "-100%" , transition: { duration: 0.5 } },
  };

  const slideDownUp = {
    initial: { y: "-100%" },
    animate: { y: 0 , transition: { duration: 0.5 } },
    exit: { y: "100%" , transition: { duration: 0.5 } },
  };

  const overlayUp = {
    initial: { y: "-100%" },
    animate: { y: 0 , transition: { duration: 0.5 } },
    exit: { opacity: 0 , transition: { duration: 0.5 } },
  };

  const fadeOut = {
    initial: { opacity: 1 },
    animate: { opacity: 0 , transition: { duration: 0.5 } },
    exit: { opacity: 0, transition: { duration: 0.5 }  },
  };

  const flip = {
    initial: { rotateY: 90 },
    animate: { rotateY: 0 },
    exit: { rotateY: 90 },
  };

  const buttonTransition = {
    type: "spring",
    stiffness: 300,
    damping: 25,
  };

  //光の粒の表示
  const [lights, setLights] = useState<{ id: number; left: string; duration: number; delay: number }[]>([]);
  const getRandomLeft = () => `${Math.random() * 100}vw`;

  useEffect(() => {
    const addLight = () => {
      const id = Date.now();
      const newLight = {
        id,
        left: getRandomLeft(),
        duration: 5 + Math.random() * 5,
        delay: Math.random() * 2,
      };

      setLights((prevLights) => [...prevLights, newLight]);

      setTimeout(() => {
        setLights((prevLights) => prevLights.filter((light) => light.id !== id));
      }, (newLight.duration + newLight.delay) * 1000);
    };

    const interval = setInterval(addLight, 350);

    return () => clearInterval(interval);
  }, []);

   //推奨環境
   if (!browserSupportsSpeechRecognition) {
    return <span>お使いのブラウザでは音声入力が使用できません:推奨 Google Chrome</span>;
  } else if (!isMicrophoneAvailable) {
    return <span>マイクの使用許可をください</span>
  }

  return (
    <AnimatePresence mode="wait">
      <div>
      {lights.map((light) => (
        <span
          key={light.id}
          className="light"
          style={{
            left: light.left,
            animationDuration: `${light.duration}s`,
            animationDelay: `${light.delay}s`,
          }}
        />
      ))}
      {dispState === 'title' &&
        <motion.div
          key="title"
          variants={pageFade}
          initial="initial"
          animate="animate"
          exit="exit"
          className="container"
      >
          <img src={wandImage} alt="Magic Wand" className="wand" />
          <h1 className="title">SpellWorker</h1>
          <p className="subtitle">Stay Awake with Magic</p>
          <div className="spell-button" onClick={() => setDispState('start')}>Click to Ready Spell</div>
        </motion.div>
      }
      {dispState === 'start' &&
        <motion.div
          key="start"
          variants={pageFade}
          initial="initial"
          animate="animate"
          exit="exit"
          className="container"
        >
          <h1 className="title">呪文</h1>
          <p className="subtitle" onClick={() => {
            setDispState('work')
            const interval = setInterval(() => {
              setCounter(prev => prev + 1);
              captureAndSendPY(videoRef, canvasRef, ctxRef, PYTHON_SLEEP_URL, setPyres)
            }, 1000);
            return () => clearInterval(interval);
          }}>Cast Opening Spell</p>
        </motion.div>
      }
      {dispState === 'work'&&
          <motion.div
            key="work"
            variants={pageFade}
            initial="initial"
            animate="animate"
            exit="exit"
            className="work-container"
          >
            <div className='work-page'>
              <h1 className="work-title">SpellWorker</h1>
              <p className="work-subtitle" onClick={() => setPyres("True")}>From the start of Work …</p>
            </div>
            <div className="timer-container">
              <div className="timer-display">
                <div className="time-section">
                  <div className="time-box">
                    <span className='time-value'>{settimer(stopCounter.current < 0 ? counter : stopCounter.current)[0]}</span>
                  </div>
                  <span className="time-label">HOURS</span>
                </div>

                <span className="separator">:</span>

                <div className="time-section">
                  <div className="time-box">
                    <span className='time-value'>{settimer(stopCounter.current < 0 ? counter : stopCounter.current)[1]}</span>
                  </div>
                  <span className="time-label">MINUTES</span>
                </div>
                <span className="separator">:</span>

                <div className="time-section">
                  <div className="time-box">
                    <span className='time-value'>{settimer(stopCounter.current < 0 ? counter : stopCounter.current)[2]}</span>
                  </div>
                  <span className="time-label">SECONDS</span>
                </div>
              </div>
            </div>

            <div className="controls">
              <button onClick={() => window.location.reload()} className="control-button">
                <div className="button-icon reset-icon"><RxCross2 /></div>
                <div className='control-text'>
                  <span className="button-text">終了</span>
                  <span className="button-subtext">{JSON.stringify(usedSpell.void1)}</span>
                </div>
              </button>

              {stopCounter.current! < 0 ?
                <div className="control-button">
                  <div className="button-icon stop-icon"  onClick={() => stopCount()}> <TbPlayerPause /> </div>
                  <div className='control-text'>
                    <span className="button-text">停止</span>
                    <span className="button-subtext">{JSON.stringify(usedSpell.void2)}</span>
                  </div>
                </div>
                :
                <div className="control-button">
                  <div className="button-icon start-icon" onClick={() => startCount()}> <PiPlayBold /></div>
                  <div className='control-text'>
                    <span className="button-text">開始</span>
                    <span className="button-subtext">{JSON.stringify(usedSpell.void2)}</span>
                  </div>
                </div>
              }
            </div>
          </motion.div>
          
      }
      {
        dispState === 'sleep' &&
          <motion.div
            key="sleep"
            variants={overlayUp}
            initial="initial"
            animate="animate"
            exit="exit"
            className="container"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              zIndex: 10, // 'sleep' コンテンツが 'work' コンテンツの上に重なるように設定
            }}
          >
            <div className="alermback">
              {imageError ? (
                <div>
                  <p>Failed to load images. Please check the image paths.</p>
                </div>
              ) : (
                displayImages.map((image, index) => (
                  <img
                    key={`${image.url}-${index}`}
                    src={image.url}
                    alt={`SVG ${index + 1}`}
                    onError={handleImageError}
                    className="alerm-img"
                    style={image.style}
                  />
                ))
              )}
            </div>
            <div className='alermspell-container'>
              <div onClick={() => { setDispState('work'); stop(), setPyres("False") }} className="alerm-text">
                呪文
              </div>
              <div className="alerm-subtext">Casting Spell To Stop The Alarm</div>
            </div>
          </motion.div>

      }
      </div>
    </AnimatePresence>
  )
}

export default App
