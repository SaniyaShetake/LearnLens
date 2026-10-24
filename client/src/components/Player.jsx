import React, { useState, useRef, useEffect } from "react";
import ReactPlayer from "react-player/lazy";
import { useAuth } from "provider/auth";
import useFeedback from "provider/feedback";
import { lessonVideoUrl } from "utils/video";

const playerStyles = {};

function Player({ lesson, cantPlay }) {
  const { user, setShowUpgradeModal } = useAuth();
  const playerRef = useRef();
  const mountedRef = useRef(false);
  const { range } = useFeedback();
  const [playing, setPlaying] = useState(false);

  const [playerOpts] = useState({
    youtube: {
      embedOptions: {
        host: "https://www.youtube-nocookie.com",
      },
      playerVars: {
        modestbranding: 1,
        fs: 0,
        iv_load_policy: 3,
        autohide: 0,
        autoplay: 0,
      },
    },
  });

  const videoOnPlay = () => {
    setPlaying(true);
  };
  const videoOnReady = () => {};
  const videoOnPause = () => {
    setPlaying(false);
  };
  const videoOnBuffer = () => {};
  const videoOnBufferEnd = () => {
    setPlaying(true);
  };

  const seekPlayer = (timestamp, pause = false) => {
    const player = playerRef.current;
    if (player && typeof player.seekTo === "function") {
      setPlaying(!pause);
      if (mountedRef.current === true) return player.seekTo(timestamp);
    }
  };

  const handleCantplay = (e) => {
    setPlaying(false);
    const player = playerRef.current;
    if (player) player.showPreview();
    if (user) {
      if (user.feature_level !== "advanced") {
        setShowUpgradeModal(true);
      }
    }
  };

  useEffect(() => {
    if (range) {
      const start = range[0] >= 1 ? range[0] * 60 : 0;

      seekPlayer(start);
    }
    mountedRef.current = true;
  }, [range, playerRef]);

  if (!lesson) return null;

  return (
    <div className="nd-overview-video">
      {cantPlay ? (
        <ReactPlayer ref={playerRef} light onClickPreview={handleCantplay} playing={playing} height="100%" style={playerStyles} controls={false} config={playerOpts} url={lessonVideoUrl(lesson)} />
      ) : (
        <ReactPlayer
          ref={playerRef}
          onBufferEnd={videoOnBufferEnd}
          onBuffer={videoOnBuffer}
          onPause={videoOnPause}
          onReady={videoOnReady}
          onPlay={videoOnPlay}
          playing={playing}
          height="100%"
          onProgress={({ playedSeconds }) => {
            const ft = Math.floor(playedSeconds);
            const startRange = range[0] >= 0 ? range[0] * 60 : 0;
            const endRange = range[1] > 0 ? range[1] * 60 : 0;

            if (ft < startRange) {
              setPlaying(true);
              seekPlayer(startRange);
            } else if (ft >= endRange) {
              seekPlayer(startRange, true);
            }
          }}
          style={playerStyles}
          controls={true}
          config={playerOpts}
          url={lessonVideoUrl(lesson)}
        />
      )}
    </div>
  );
}

export default Player;
