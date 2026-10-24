import * as React from "react";
import Footer from "components/Footer";
import Header from "components/Header";
import ReactPlayer from "react-player/lazy";

function VideoPage() {
  const playerOpts = {
    youtube: {
      embedOptions: {
        host: "https://www.youtube-nocookie.com",
      },
      playerVars: {
        modestbranding: 1,
        fs: 1,
        iv_load_policy: 3,
        autohide: 0,
        autoplay: 0,
      },
    },
  };

  const playerStyles = {};

  React.useEffect(() => {
    if (window) {
      window.scrollTo(0, 0);
    }
  }, []);

  return (
    <>
      <Header pageName="Guidelines" />
      <section className="full-height">
        <div className="container-fluid video-player h-100">
          <div className="row justify-content-center h-100">
            <div className="col py-5 h-100">
              <ReactPlayer height="100%" width="100%" style={playerStyles} controls config={playerOpts} url={"https://youtu.be/ablQhA-iNO4"} />
            </div>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}

export default VideoPage;
