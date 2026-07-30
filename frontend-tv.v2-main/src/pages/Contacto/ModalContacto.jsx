import React, { useEffect, useState } from "react";

import api from "../../utils/api";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import Swal from "sweetalert2";
import ModalComponent from "../../components/ModalComponent/ModalComponent";
import { otherEmail, phoneValidate } from "../../utils/regexValidate.js";

const UpdateSchemaContact = Yup.object().shape({
    nombreContact: Yup.string(),
    email: Yup.string().matches(otherEmail, "Debe ser un correo válido"),
    telefono: Yup.string().matches(
        phoneValidate,
        "Debe ser un teléfono válido"
    ),
});

const ModalContacto = ({
    itemId,
    modalOpen,
    setModalOpen,
    title,
    refreshList,
}) => {
    const [dataContact, setDataContact] = useState(null);

    useEffect(() => {
        if (itemId) {
             
            api.getIdContact(itemId).then((res) => {
                 
                setDataContact(res.data);
            });
        }
    }, [itemId]);

    if (!dataContact) return null;
    return (
        <>
            <Formik
                initialValues={{
                    nombreContact: dataContact.nombreContact || "",
                    email: dataContact.email || "",
                    telefono: dataContact.telefono || "",
                }}
                validationSchema={UpdateSchemaContact}
                onSubmit={async (values, { resetForm }) => {
                    try {
                        await api.updateContact(itemId, values);
                         
                        Swal.fire({
                            icon: "success",
                            title: "Contacto actualizado",
                            text: "El contacto se ha actualizado exitosamente!",
                            footer: `<h4>${values.nombreContact}</h4>
        <h4>${values.email}</h4>
        
        `,
                        });
                        refreshList();
                        setModalOpen(false);
                        resetForm();
                    } catch (error) {
                        Swal.fire({
                            icon: "error",
                            title: "Ups!!",
                            text: `${
                                error.response?.data?.message ||
                                "Error desconocido"
                            }`,
                        });
                        console.error(error);
                    }
                }}
            >
                {({ errors, touched }) => (
                    <ModalComponent
                        modalOpen={modalOpen}
                        title={title}
                        setModalOpen={setModalOpen}
                    >
                        <Form className="form__add">
                            <div className="rows__group">
                                <div className="columns__group">
                                    <div className="form__group">
                                        <label
                                            htmlFor="nombreContact"
                                            className="form__group-label"
                                        >
                                            Nombre contacto
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Nombre contacto"
                                                name="nombreContact"
                                            />
                                        </label>

                                        {errors.nombreContact &&
                                        touched.nombreContact ? (
                                            <div className="form__group-error">
                                                {errors.nombreContact}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="form__group">
                                        <label
                                            htmlFor="email"
                                            className="form__group-label"
                                        >
                                            Email
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Email"
                                                name="email"
                                            />
                                        </label>

                                        {errors.email && touched.email ? (
                                            <div className="form__group-error">
                                                {errors.email}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="form__group">
                                        <label
                                            htmlFor="telefono"
                                            className="form__group-label"
                                        >
                                            Teléfono
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Teléfono"
                                                name="telefono"
                                            />
                                        </label>

                                        {errors.telefono && touched.telefono ? (
                                            <div className="form__group-error">
                                                {errors.telefono}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                </div>
                <button
                  type="submit"
                  className={`button btn-primary`}
                >
                  Enviar
                </button>
                        </Form>
                    </ModalComponent>
                )}
            </Formik>
        </>
    );
};

export default ModalContacto;
