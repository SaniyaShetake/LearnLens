import React, { useEffect, useState } from "react";
import { Navbar, Nav, Button, NavDropdown, Modal } from "react-bootstrap";
import { NavLink, useHistory } from "react-router-dom";
import { useAuth } from "provider/auth";
import { useStudentAuth } from "provider/student-auth";
import { useQuery } from "utils/query";


const TakeTour = () => {
  const history = useHistory();
  const { backto } = useQuery();
  const { user, handleOpenTour, handleCloseTour } = useAuth();

  const [showModal, setShowModal] = useState(false);

  const handleToggleModal = () => {
    setShowModal((s) => !s);
  };

  const handleTakeTour = () => {
    setShowModal(false);
    handleOpenTour();
  };

  const handleCloseModal = () => {
    setShowModal(false);
    handleCloseTour();
    if (backto) {
      history.replace("/l/" + backto + "/dashboard");
    }
  };

  useEffect(() => {
    if (user && user.tour) {
      if (user.tour.dashboard > 0) {
        setShowModal(false);
      } else {
        setShowModal(true);
      }
    }
  }, [user]);

  return (
    <>
      <Button onClick={handleToggleModal} size="sm" variant="outline-info" className="nav-tour-btn ml-2">
        Take tour
      </Button>

      <Modal className="tour-modal" show={showModal} onHide={handleCloseModal}>
        <Modal.Header closeButton closeLabel="Skip tour">
          <Modal.Title>Take the tour</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="font-weight-light mb-3">The teacher dashboard has different sections to help you analyze student feedback and make decisions to refine and improve the teaching practices.</div>
          <div className="font-weight-light mb-3">This tour will walk you through the different sections where you will get the following information: purpose, features, and how to use</div>
          <div className="font-weight-light mb-3">It is recommended to go through each section before starting to use the dashboard to analyze student feedback.</div>
          <div className="font-weight-medium mb-3">Take the tour to familiarize yourself with the dashboard. You can also choose to skip the tour and begin right away!</div>
        </Modal.Body>
        <Modal.Footer className="d-flex justify-content-center">
          <div className="d-flex flex-column justify-content-center">
            <Button onClick={handleTakeTour}>Take the tour</Button>
            <Button onClick={handleCloseModal} className="mt-2" variant="link">
              Skip tour
            </Button>
          </div>
        </Modal.Footer>
      </Modal>
    </>
  );
};

const Header = ({ minifiedNav = false, pageName = "Feedback", lessonName = "", className = "", navClasses = "", hasTour = false, forStudent = false }) => {
  const { user, request, logout, viewAdvanced, showUpgradeModal, setShowUpgradeModal } = useAuth();

  const handleLogout = (e) => {
    e.preventDefault();
    logout()
      .then(() => {
        window.location.href = "/";
      })
      .catch();
  };

  const handleShowUpgradeModal = () => {
    setShowUpgradeModal(true);
  };
  const handleCloseUpgradeModal = () => {
    setShowUpgradeModal(false);
  };

  const handleUpgrade = (e) => {
    viewAdvanced();
    request("PUT", "/auth/upgrade", {}).catch((err) => console.log(err));
    handleCloseUpgradeModal();
  };

  return (
    <header className={className + (minifiedNav ? " header-minified" : "")}>
      <Navbar expand="md" className={navClasses + (minifiedNav ? " nav-minified" : "")}>
        <Navbar.Brand href="/">
          <span className="logo">LearnLens</span>
          {pageName && <span className="header-page-name"> {pageName} </span>}
        </Navbar.Brand>
        {lessonName && <Navbar.Text className="text-dark">{lessonName}</Navbar.Text>}
        {hasTour && <TakeTour />}
        <Modal centered className="upgrade-modal" show={showUpgradeModal} onHide={handleCloseUpgradeModal}>
          <Modal.Header closeButton>
            <Modal.Title>Upgrade to advanced</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="text-center">If you wish to proceed, you'll get access to advanced features</p>
            <ul>
              {/* <li>Access to your videos</li> */}
              <li>Interactive dashboard for advanced analysis</li>
              <li>Write to-do’s based on analysis</li>
              <li>Save your analysis</li>
            </ul>
          </Modal.Body>
          <Modal.Footer className="d-flex justify-content-center">
            <div className="d-flex flex-column justify-content-center">
              <Button onClick={handleUpgrade}>Upgrade</Button>
              <Button onClick={handleCloseUpgradeModal} className="mt-2" variant="link">
                Cancel
              </Button>
            </div>
          </Modal.Footer>
        </Modal>
        <Navbar.Toggle aria-controls="navbar-collapse" />
        <Navbar.Collapse id="navbar-collapse">
          <Nav className="ml-auto">
            <Nav.Link as={NavLink} to="/" exact>
              Home
            </Nav.Link>
            {user ? (
              <>
                {/* {minifiedNav && <Nav.Link onClick={viewAdvanced}>Switch Dashboard</Nav.Link>} */}

                <Nav.Link as={NavLink} to="/dashboard" exact>
                  Dashboard
                </Nav.Link>
                <Nav.Link as={NavLink} to="/research" exact>
                  Research
                </Nav.Link>
                <Nav.Link as={NavLink} to="/guidelines" exact>
                  Guidelines
                </Nav.Link>
                <Nav.Link as={NavLink} to="/ai-tutor" exact>
                  <i className="fas fa-robot mr-1" /> AI Doubt Solver
                </Nav.Link>
                <NavDropdown alignRight className="nav-profile-drop" title={<i className="fas fa-user-alt" />} id="nav-profile-drop">
                  {user.feature_level !== "advanced" && (
                    <>
                      <NavDropdown.Item active={false} onClick={handleShowUpgradeModal} className="upgrade-item">
                        <i className="fas fa-arrow-circle-up mr-2" style={{ fontSize: "0.8rem" }} />Upgrade
                      </NavDropdown.Item>
                      <NavDropdown.Divider />
                    </>
                  )}
                  <NavDropdown.Item active={false} onClick={handleLogout}>
                    <i className="fas fa-sign-out-alt mr-2" style={{ fontSize: "0.8rem" }} />Logout
                  </NavDropdown.Item>
                </NavDropdown>
              </>
            ) : (
              <>
                <Nav.Link as={NavLink} to="/research" exact>
                  Research
                </Nav.Link>
                {!forStudent ? (
                  <>
                    <Nav.Link as={NavLink} to="/guidelines" exact>
                      Guidelines
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/register" exact>
                      Signup
                    </Nav.Link>
                    <Nav.Link as={NavLink} to="/login" exact>
                      Login
                    </Nav.Link>
                  </>
                ) : (
                  <>
                    <StudentAuthLogout />
                  </>
                )}
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Navbar>
    </header>
  );
};

function StudentAuthLogout() {
  const { isLoggedIn, logout } = useStudentAuth();

  const handleLogout = (e) => {
    logout()
      .then(() => {
        console.log("logged out");
      })
      .catch();
  };

  if (isLoggedIn) return <Nav.Link onClick={handleLogout}>Logout</Nav.Link>;

  return null;
}

export default Header;
