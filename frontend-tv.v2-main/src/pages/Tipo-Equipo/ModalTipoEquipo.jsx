import React, { useEffect, useState } from "react";
import { Modal } from "antd";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import Swal from "sweetalert2";

import api from "../../utils/api";

const TipoEquipoSchema = Yup.object().shape({
    tipoNombre: Yup.string()
        .trim()
        .required("Campo obligatorio"),
});

const ModalTipoEquipo = ({
    isModalOpen,
    handleOk,
    handleCancel,
    itemId,
    refreshList,
}) => {
    const [initialValues, setInitialValues] = useState(null);

    useEffect(() => {
        if (!isModalOpen || !itemId) {
            setInitialValues(null);
            return;
        }

        let isMounted = true;

        api
            .getIdTipoEquipo(itemId)
            .then((response) => {
                const data = response?.data || {};
                if (isMounted) {
                    setInitialValues({
                        tipoNombre: data.tipoNombre || "",
                    });
                }
            })
            .catch(() => {
                Swal.fire({
                    icon: "error",
                    title: "Error",
                    text: "No se pudo obtener la información del tipo de equipo",
                });
                if (isMounted) {
                    setInitialValues({ tipoNombre: "" });
                }
            });

        return () => {
            isMounted = false;
        };
    }, [isModalOpen, itemId]);

    const handleSubmit = async (values, { setSubmitting }) => {
        try {
            const payload = {
                tipoNombre: values.tipoNombre.trim(),
            };

            await api.updateTipoEquipo(itemId, payload);

            Swal.fire(
                "Actualizado",
                "El tipo de equipo fue actualizado correctamente",
                "success"
            );

            if (typeof refreshList === "function") {
                await refreshList();
            }

            handleOk();
        } catch (error) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: "No se pudo actualizar el tipo de equipo",
                footer:
                    error?.response?.data?.message ||
                    "Inténtalo nuevamente más tarde",
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal
            open={isModalOpen}
            onOk={handleOk}
            onCancel={handleCancel}
            footer={null}
            destroyOnClose
        >
            {initialValues ? (
                <Formik
                    initialValues={initialValues}
                    validationSchema={TipoEquipoSchema}
                    onSubmit={handleSubmit}
                    enableReinitialize
                >
                    {({ isSubmitting }) => (
                        <Form className="form form__modal">
                            <h1 className="form__titulo">Editar tipo de equipo</h1>

                            <div className="form__group">
                                <label>
                                    Nombre tipo de equipo
                                    <br />
                                    <Field
                                        name="tipoNombre"
                                        type="text"
                                        className="form__group-input"
                                        placeholder="Nombre"
                                    />
                                    <ErrorMessage
                                        name="tipoNombre"
                                        component="div"
                                        className="form__group-error"
                                    />
                                </label>
                            </div>

                            <div className="form__group">
                                <button
                                    className="button separate btn-primary"
                                    type="submit"
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? "Guardando..." : "Guardar cambios"}
                                </button>
                            </div>
                        </Form>
                    )}
                </Formik>
            ) : (
                <div className="form__group" style={{ textAlign: "center" }}>
                    Cargando información...
                </div>
            )}
        </Modal>
    );
};

export default ModalTipoEquipo;

