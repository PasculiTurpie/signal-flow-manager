import React, { useEffect, useState } from "react";
import { Modal } from "antd";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import Swal from "sweetalert2";
import api from "../../utils/api";

// Esquema de validación
const EditSchema = Yup.object().shape({
    satelliteName: Yup.string().required("Campo obligatorio"),
    satelliteUrl: Yup.string()
        .url("URL no válida")
        .required("Campo obligatorio"),
    satelliteType: Yup.string().required("Selecciona una opción"),
});

const ModalForm = ({
    isModalOpen,
    handleOk,
    handleCancel,
    itemId,
    refreshList,
}) => {
    const [polarizations, setPolarizations] = useState([]);
    const [initialValues, setInitialValues] = useState(null);
    const [selectedPolarization, setSelectedPolarization] = useState("");

    useEffect(() => {
        if (itemId) {
            api.getSatelliteId(itemId).then((res) => {
                setSelectedPolarization(res.satelliteType._id);
                setInitialValues({
                    satelliteName: res.satelliteName,
                    satelliteUrl: res.satelliteUrl,
                    satelliteType: res.satelliteType._id, // Asegura que sea el ID
                });
            });

            api.getPolarizations().then((res) => {
                setPolarizations(res);
            });
        }
    }, [itemId]);

    const handleSubmit = async (values) => {
        try {
            await api.updateSatelite(values, itemId);
            Swal.fire(
                "Actualizado",
                "El satélite fue actualizado correctamente",
                "success"
            );
            handleOk(); // cierra el modal
            refreshList(); // recarga la lista si la función está disponible
        } catch (error) {
            console.error("Error al actualizar:", error);
            Swal.fire("Error", "No se pudo actualizar el satélite", "error");
        }
    };

    return (
        <Modal
            open={isModalOpen}
            onOk={handleOk}
            onCancel={handleCancel}
            footer={null}
        >
            {initialValues && (
                <Formik
                    initialValues={initialValues}
                    validationSchema={EditSchema}
                    onSubmit={handleSubmit}
                    enableReinitialize
                >
                    {({ errors, touched }) => (
                        <Form className="form form__modal">
                            <h1 className="form__titulo">Editar satélite</h1>

                            <div className="form__group">
                                <label>
                                    Nombre Satélite
                                    <br />
                                    <Field
                                        name="satelliteName"
                                        type="text"
                                        className="form__group-input"
                                        placeholder="Nombre"
                                    />
                                    {errors.satelliteName &&
                                        touched.satelliteName && (
                                            <div className="form__group-error">
                                                {errors.satelliteName}
                                            </div>
                                        )}
                                </label>
                            </div>

                            <div className="form__group">
                                <label>
                                    URL web
                                    <br />
                                    <Field
                                        name="satelliteUrl"
                                        type="text"
                                        className="form__group-input"
                                        placeholder="URL"
                                    />
                                    {errors.satelliteUrl &&
                                        touched.satelliteUrl && (
                                            <div className="form__group-error">
                                                {errors.satelliteUrl}
                                            </div>
                                        )}
                                </label>
                            </div>

                            <div className="form__group">
                                <label>
                                    Polarización
                                    <br />
                                    <Field
                                        name="satelliteType"
                                        as="select"
                                        className="form__group-input"
                                        defaulValues={selectedPolarization}
                                    >
                                        <option value="">
                                            --Seleccionar--
                                        </option>
                                        {polarizations.map((polarization) => (
                                            <option
                                                key={polarization._id}
                                                value={polarization._id}
                                            >
                                                {polarization.typePolarization}
                                            </option>
                                        ))}
                                    </Field>
                                    {errors.satelliteType &&
                                        touched.satelliteType && (
                                            <div className="form__group-error">
                                                {errors.satelliteType}
                                            </div>
                                        )}
                                </label>
                            </div>

                            <div className="form__group">
                                <button
                                    className="button separate btn-primary"
                                    type="submit"
                                >
                                    Guardar cambios
                                </button>
                            </div>
                        </Form>
                    )}
                </Formik>
            )}
        </Modal>
    );
};

export default ModalForm;
