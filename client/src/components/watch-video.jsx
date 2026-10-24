import * as React from "react";
import ReactPlayer from "react-player/lazy";
import { Button, Modal } from "react-bootstrap";

function WatchVideo() {
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

  const [open, setOpen] = React.useState(false);

  const handleClose = () => {
    setOpen(false);
  };

  const handleOpen = () => {
    setOpen(true);
  };

  return (
    <>
      <Button size="sm" variant="outline-primary" onClick={handleOpen}>
        <span>Watch video </span>
        <i className="fas fa-play-circle" />
      </Button>

      <Modal centered size="xl" show={open} onHide={handleClose}>
        <Modal.Header closeButton>
          <Modal.Title>Tcherly Introduction</Modal.Title>
        </Modal.Header>
        <Modal.Body className="video-modal-body">
          <ReactPlayer height="100%" width="auto" style={playerStyles} controls config={playerOpts} url={"https://youtu.be/ablQhA-iNO4"} />
        </Modal.Body>
        <Modal.Footer className="justify-content-center">
          <Button variant="outline-dark" onClick={handleClose}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default WatchVideo;
