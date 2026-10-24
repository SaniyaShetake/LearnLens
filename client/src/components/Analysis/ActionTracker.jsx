import useFeedback from "provider/feedback";
import React, { useState } from "react";
import Select from "react-select";
import { Button as BSButton, Modal, Button, Form } from "react-bootstrap";
import { useFormik } from "formik";
import { useAuth } from "provider/auth";

function ActionTracker() {
  const { currentBookmark, setCurrentBookmark, questions, actions, setActions } = useFeedback();
  const { request } = useAuth();

  const [showModal, setShowModal] = useState({
    add: false,
    edit: false,
    delete: false,
  });

  const addFormik = useFormik({
    initialValues: {
      action: "",
      future_action: "",
      question: null,
    },
    onSubmit: (values) => {
      if (currentBookmark) {
        request("PUT", `/lessons/bookmark/${currentBookmark._id}/add-action`, {
          action: {
            question: values.question,
            action: values.action,
            future_action: values.future_action,
          },
        }).catch((err) => console.log(err));
        setCurrentBookmark((cb) => ({ ...cb, actions: [...cb.actions, values] }));
      } else {
        setActions((a) => [...a, values]);
      }
    },
  });

  const handleShowModal = (type, id) => (e) => {
    e.preventDefault();

    if (type === "add") {
      setShowModal({ add: true, edit: false, delete: false });
    } else if (type === "edit") {
      let v;
      if (currentBookmark) {
        v = currentBookmark.actions[id];
      } else {
        v = actions[id];
      }
      setShowModal({ add: false, delete: false, edit: id });
      editFormik.setValues({ ...v });
    } else if (type === "delete") {
      setShowModal({ add: false, edit: false, delete: id });
    }
  };

  const handleCloseModal = () => {
    setShowModal({ add: false, edit: false, delete: false });
  };

  const handleAddSubmit = (e) => {
    addFormik.handleSubmit();
    handleCloseModal();
  };

  const handleSelection = (option) => {
    addFormik.setFieldValue("question", option.value);
  };

  const prepareActionsList = () => {
    const _actions = currentBookmark ? currentBookmark.actions : actions;

    const groupedActions = {};

    _actions.forEach((a) => {
      if (!groupedActions[a.question]) {
        groupedActions[a.question] = [];
      }
      groupedActions[a.question].push(a);
    });

    const groupedActionsArray = [];

    Object.keys(groupedActions).forEach((questionKey) => {
      groupedActionsArray.push(
        ...groupedActions[questionKey].map((a, k) => ({
          sr_no: typeof a.question === "number" ? parseInt(a.question) + 1 + "." + (k + 1) : "",
          ...a,
        }))
      );
    });

    return groupedActionsArray;
  };

  const editFormik = useFormik({
    initialValues: {
      action: "",
      future_action: "",
      question: null,
    },
    onSubmit: (values, { resetForm }) => {
      if (currentBookmark) {
        setCurrentBookmark((cb) => {
          const result = Array.from(cb.actions);

          if (result) {
            const r = result[showModal.edit];
            if (r) {
              result[showModal.edit] = { ...r, ...values };
            }
          }

          request("PUT", `/lessons/bookmark/${currentBookmark._id}/edit-actions`, {
            actions: result,
          }).catch((err) => console.log(err));

          return { ...cb, actions: result };
        });
      } else {
        setActions((qs) => {
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
        const result = Array.from(cb.actions);

        if (result) {
          result.splice(showModal.delete, 1);
        }

        request("PUT", `/lessons/bookmark/${currentBookmark._id}/edit-actions`, {
          actions: result,
        }).catch((err) => console.log(err));

        return { ...cb, actions: result };
      });
    } else {
      setActions((qs) => {
        const result = Array.from(qs);
        if (result) {
          result.splice(showModal.delete, 1);
          return result;
        }
        return qs;
      });
    }
    handleCloseModal();
  };

  return (
    <>
      <Modal centered show={showModal.add} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>Add action</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group controlId="add-question-name">
              <Form.Label>Question or finding</Form.Label>
              <Select options={(currentBookmark ? currentBookmark.questions : questions).map((q, k) => ({ value: k, label: q.name }))} name="question" onChange={handleSelection} type="select" />
            </Form.Group>
            <Form.Group controlId="add-question-name">
              <Form.Label>Add the action you have taken for the above question or finding here</Form.Label>
              <Form.Control as="textarea" onChange={addFormik.handleChange} value={addFormik.values.action} name="action" type="text" />
            </Form.Group>
            <Form.Group controlId="add-question-name">
              <Form.Label>Add the actions you plan to take in the future</Form.Label>
              <Form.Control as="textarea" onChange={addFormik.handleChange} value={addFormik.values.future_action} name="future_action" type="text" />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Close
          </Button>
          <Button variant="primary" onClick={handleAddSubmit}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
      <Modal centered show={showModal.edit !== false} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title>Edit action</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group controlId="add-question-name">
              <Form.Label>Enter your question or findings here</Form.Label>
              <Form.Control as="textarea" onChange={editFormik.handleChange} value={editFormik.values.action} name="action" type="text" />
            </Form.Group>
            <Form.Group controlId="add-question-name">
              <Form.Label>Enter your thoughts about what to be done based on above</Form.Label>
              <Form.Control as="textarea" onChange={editFormik.handleChange} value={editFormik.values.future_action} name="future_action" type="text" />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseModal}>
            Close
          </Button>
          <Button variant="primary" onClick={editFormik.handleSubmit}>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>
      <Modal centered show={showModal.delete !== false} onHide={handleCloseModal}>
        <Modal.Header closeButton>
          <Modal.Title className="text-danger">Delete action</Modal.Title>
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

      <div className="td-actions-taken">
        <div className="td-qgat-container">
          <div className="td-qgat-header">
            <div className="td-qgat header-row">
              <div className="c1">No.</div>
              <div className="c2">What action have I taken?</div>
              <div className="c3">Any future action items?</div>
              <div className="c4">
                <div className="btn btn-none nd-btn-save" onClick={handleShowModal("add")}>
                  Add Action
                </div>
              </div>
            </div>
          </div>
          <div className="td-qgat-rows">
            {prepareActionsList().map((action, k) => {
              return (
                <div className="td-qgat" key={k}>
                  <div className="c1">{action.sr_no}</div>
                  <div className="c2">{action.action}</div>
                  <div className="c3">{action.future_action}</div>
                  <div className="c4">
                    <div title="Edit" className="btn btn-sm btn-edit mr-2" onClick={handleShowModal("edit", k)}>
                      <i className="fas fa-pen" />
                    </div>
                    <div title="Delete" className="btn btn-sm btn-delete" onClick={handleShowModal("delete", k)}>
                      <i className="fas fa-trash" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="table-responsive">
          <table className="table table-sm table-bordered table-light td-table">
            <thead>
              <tr key={-1}>
                <th width="5%">#</th>
                <th width="40%">What action have I taken?</th>
                <th width="40%">Any future action items?</th>
                <th width="15%" className="text-center">
                  <BSButton onClick={handleShowModal("add")} size="sm" variant="none" className="nd-btn-action ml-auto">
                    Add Action
                  </BSButton>
                </th>
              </tr>
            </thead>
            <tbody>
              {prepareActionsList().map((action, k) => {
                return (
                  <tr key={k}>
                    <td>{action.sr_no}</td>
                    <td>{action.action}</td>
                    <td>{action.future_action}</td>
                    <td className="text-center">
                      <Button className="mr-2" size="sm" variant="primary" onClick={handleShowModal("edit", k)}>
                        <i className="fas fa-pen" />
                      </Button>
                      <Button size="sm" variant="danger" onClick={handleShowModal("delete", k)}>
                        <i className="fas fa-trash" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function ActionTrackerBasic() {
  return (
    <div className="td-actions-taken">
      <div className="table-responsive">
        <table className="table table-sm table-bordered table-light td-table">
          <thead>
            <tr key={-1}>
              <th width="5%">#</th>
              <th width="40%">What action have I taken?</th>
              <th width="40%">Any future action items?</th>
              <th width="15%" className="text-center">
                <BSButton size="sm" variant="none" className="nd-btn-action ml-auto">
                  Add Action
                </BSButton>
              </th>
            </tr>
          </thead>
          <tbody />
        </table>
      </div>
    </div>
  );
}

export { ActionTrackerBasic };

export default ActionTracker;
