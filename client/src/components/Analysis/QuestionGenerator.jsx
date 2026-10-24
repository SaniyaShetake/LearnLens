import useFeedback from "provider/feedback";
import React, { useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { useFormik } from "formik";
import { useAuth } from "provider/auth";

function QuestionGenerator() {
  const { currentBookmark, setCurrentBookmark, questions, setQuestions } = useFeedback();
  const { request } = useAuth();

  const [showModal, setShowModal] = useState({
    add: false,
    edit: false,
    delete: false,
  });

  const handleCloseModal = () => {
    setShowModal({ add: false, edit: false, delete: false });
  };

  const addFormik = useFormik({
    initialValues: {
      name: "",
      action: "",
    },
    onSubmit: (values, { resetForm }) => {
      // TODO: After currentBookmark setup
      // api.put(`/lessons/${lesson._id}/${bookmark._id}`);

      if (currentBookmark) {
        request("PUT", `/lessons/bookmark/${currentBookmark._id}/add-question`, {
          question: {
            name: values.name,
            action: values.action,
          },
        }).catch((err) => console.log(err));

        setCurrentBookmark((s) => {
          return {
            ...s,
            questions: [...s.questions, values],
          };
        });
      } else {
        setQuestions((s) => [...s, values]);
      }

      resetForm();
      handleCloseModal();
    },
  });

  const editFormik = useFormik({
    initialValues: {
      name: "",
      action: "",
    },
    onSubmit: (values, { resetForm }) => {
      if (currentBookmark) {
        setCurrentBookmark((cb) => {
          const result = Array.from(cb.questions);

          if (result) {
            const r = result[showModal.edit];
            if (r) {
              result[showModal.edit] = { ...r, ...values };
            }
          }

          request("PUT", `/lessons/bookmark/${currentBookmark._id}/edit-questions`, {
            questions: result,
          }).catch((err) => console.log(err));

          return { ...cb, questions: result };
        });
      } else {
        setQuestions((qs) => {
          const result = Array.from(qs);
          if (result) {
            const r = result[showModal.edit];
            if (r) {
              result[showModal.edit] = { ...r, ...values };
            }
            return result;
          }
          return qs;
        });
      }

      resetForm();
      handleCloseModal();
    },
  });

  const handleDeleteSubmit = (e) => {
    e.preventDefault();

    if (currentBookmark) {
      setCurrentBookmark((cb) => {
        const result = Array.from(cb.questions);
        if (result) result.splice(showModal.delete, 1);
        request("PUT", `/lessons/bookmark/${currentBookmark._id}/edit-questions`, { questions: result }).catch((err) => console.log(err));
        return { ...cb, questions: result };
      });
    } else {
      setQuestions((qs) => {
        const result = Array.from(qs);
        if (result) { result.splice(showModal.delete, 1); return result; }
        return qs;
      });
    }
    handleCloseModal();
  };

  const handleRemove = (k) => () => {
    if (currentBookmark) {
      setCurrentBookmark((cb) => {
        const result = Array.from(cb.questions);
        result.splice(k, 1);
        request("PUT", `/lessons/bookmark/${currentBookmark._id}/edit-questions`, { questions: result }).catch((err) => console.log(err));
        return { ...cb, questions: result };
      });
    } else {
      setQuestions((qs) => {
        const result = Array.from(qs);
        result.splice(k, 1);
        return result;
      });
    }
  };

  const handleShowModal = (type, id) => (e) => {
    e.preventDefault();

    if (type === "add") {
      setShowModal({ add: true, edit: false, delete: false });
    } else if (type === "edit") {
      let v;
      if (currentBookmark) {
        v = currentBookmark.questions[id];
      } else {
        v = questions[id];
      }
      setShowModal({ add: false, delete: false, edit: id });
      editFormik.setValues({ ...v });
    } else if (type === "delete") {
      setShowModal({ add: false, edit: false, delete: id });
    }
  };

  return (
    <>
      <Modal centered show={showModal.add} onHide={handleCloseModal}>
        <Modal.Header closeButton style={{ background: "#3b0764", color: "#f3e8ff" }}>
          <Modal.Title style={{ color: "#f3e8ff" }}>Add question</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form className="login-form">
            <Form.Group controlId="add-question-name">
              <Form.Label>Question or finding</Form.Label>
              <Form.Control as="textarea" rows={2} onChange={addFormik.handleChange} value={addFormik.values.name} name="name" />
            </Form.Group>
            <Form.Group controlId="add-question-action">
              <Form.Label>What can be done?</Form.Label>
              <Form.Control as="textarea" rows={2} onChange={addFormik.handleChange} value={addFormik.values.action} name="action" />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer style={{ borderTop: "1px solid #e9d5ff" }}>
          <Button variant="outline-secondary" onClick={handleCloseModal}>Cancel</Button>
          <Button style={{ background: "#9333ea", border: "none" }} onClick={addFormik.handleSubmit}>Save</Button>
        </Modal.Footer>
      </Modal>
      <Modal centered show={showModal.edit !== false} onHide={handleCloseModal}>
        <Modal.Header closeButton style={{ background: "#3b0764", color: "#f3e8ff" }}>
          <Modal.Title style={{ color: "#f3e8ff" }}>Edit question</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form className="login-form">
            <Form.Group controlId="edit-question-name">
              <Form.Label>Question or finding</Form.Label>
              <Form.Control as="textarea" rows={2} onChange={editFormik.handleChange} value={editFormik.values.name} name="name" />
            </Form.Group>
            <Form.Group controlId="edit-question-action">
              <Form.Label>What can be done?</Form.Label>
              <Form.Control as="textarea" rows={2} onChange={editFormik.handleChange} value={editFormik.values.action} name="action" />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer style={{ borderTop: "1px solid #e9d5ff" }}>
          <Button variant="outline-secondary" onClick={handleCloseModal}>Cancel</Button>
          <Button style={{ background: "#9333ea", border: "none" }} onClick={editFormik.handleSubmit}>Save</Button>
        </Modal.Footer>
      </Modal>
      <Modal centered show={showModal.delete !== false} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title className="text-danger">Delete question</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          <h5 className="mb-0 text-danger">Are you sure you want to delete this?</h5>
          <p className="text-muted">Note: This action cannot be reverted</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteSubmit}>
            Confirm Delete
          </Button>
        </Modal.Footer>
      </Modal>
      <div className="td-questions-container">
        {/* {questions.length > 0 ? ( */}
        <div className="td-qgat-container">
          <div className="td-qgat-header">
            <div className="td-qgat header-row">
              <div className="c1">No.</div>
              <div className="c2">Question (or finding) based on analysis</div>
              <div className="c3">What can be done?</div>
              <div className="c4">
                <button
                  onClick={handleShowModal("add")}
                  style={{
                    background: "#9333ea",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    padding: "3px 10px",
                    fontSize: "inherit",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    whiteSpace: "nowrap",
                  }}
                >
                  <i className="fas fa-plus" style={{ fontSize: "0.75em" }} /> Add
                </button>
              </div>
            </div>
          </div>
          <div className="td-qgat-rows">
            {(currentBookmark ? currentBookmark.questions : questions).map((question, k) => (
              <div className="td-qgat" key={k}>
                <div className="c1">{k + 1}</div>
                <div className="c2">{question.name}</div>
                <div className="c3">{question.action}</div>
                <div className="c4" style={{ flexDirection: "column", gap: 3 }}>
                  <div title="Edit" className="btn btn-sm btn-edit" onClick={handleShowModal("edit", k)}>
                    <i className="fas fa-pen" />
                  </div>
                  <button
                    title="Remove"
                    onClick={handleRemove(k)}
                    style={{
                      background: "#fce7f3",
                      border: "none",
                      borderRadius: 4,
                      padding: "1px 6px",
                      fontSize: "0.7em",
                      color: "#b91c1c",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ✕ Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function QuestionGeneratorBasic() {
  return (
    <div className="td-questions-container">
      <div className="table-responsive">
        <table className="table table-sm table-bordered table-light td-table">
          <thead>
            <tr key={-1}>
              <th width="5%">#</th>
              <th width="40%">Questions or findings based on analysis</th>
              <th width="40%">What can be done?</th>
              <th width="15%" className="text-center">
                <Button size="sm" variant="none" className="nd-btn-action ml-auto">
                  New Question
                </Button>
              </th>
            </tr>
          </thead>
          <tbody />
        </table>
      </div>
    </div>
  );
}

export { QuestionGeneratorBasic };

export default QuestionGenerator;
