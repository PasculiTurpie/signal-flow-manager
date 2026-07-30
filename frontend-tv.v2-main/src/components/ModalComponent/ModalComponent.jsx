import { useCallback, useId } from "react";

import "./ModalComponent.css";
import Close from "../../../public/images/close.svg";

const ModalComponent = ({ modalOpen, title, setModalOpen, children }) => {
    const titleId = useId();

    const handleCloseModal = useCallback(() => {
        setModalOpen(false);
    }, [setModalOpen]);

    return (
        <div
            className={
                modalOpen
                    ? "container__modal-component show__modal"
                    : "container__modal-component close__modal"
            }
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
        >
            <div className="form__modal-component">
                <div className="modal__header">
                    <div className="modal__title">
                        <h4 id={titleId}>{title}</h4>
                    </div>
                    <button
                        type="button"
                        className="modal__close"
                        onClick={handleCloseModal}
                        aria-label="Cerrar modal"
                    >
                        <img src={Close} alt="" aria-hidden="true" />
                    </button>
                </div>

                <div className="form__modal-component-margen">{children}</div>
            </div>
        </div>
    );
};

export default ModalComponent;
