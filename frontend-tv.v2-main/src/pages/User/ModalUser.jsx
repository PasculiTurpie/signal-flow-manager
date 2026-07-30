import React, { useEffect, useState } from "react";
import ModalComponent from "../../components/ModalComponent/ModalComponent";
import api from "../../utils/api";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import Swal from "sweetalert2";

const EditSchemaUser = Yup.object().shape({
    username: Yup.string(),
    email: Yup.string().email("Debe ser un correo válido"),
    profilePicture: Yup.string()
        .test(
            "starts-with-http",
            "La URL debe comenzar con http:// o https://",
            (value) =>
                value?.startsWith("http://") || value?.startsWith("https://")
        )
        .url("Debe ser una URL válida"),
    password: Yup.string()
        .nullable()
        .test(
            "optional-password",
            "No cumple con las reglas",
            function (value) {
                if (!value) return true;
                return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(
                    value
                );
            }
        ),
    confirmPassword: Yup.string().when("password", {
        is: (val) => val && val.length > 0,
        then: (schema) =>
            schema
                .required("Debes confirmar la contraseña")
                .oneOf([Yup.ref("password")], "Las contraseñas no coinciden"),
        otherwise: (schema) => schema.nullable(),
    }),

    role: Yup.string(),
});

const ModalUser = ({ itemId, modalOpen, setModalOpen, title, refreshList }) => {
    const [dataUser, setDataUser] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [fetchError, setFetchError] = useState(null);

    useEffect(() => {
        if (!modalOpen) {
            setDataUser(null);
            setFetchError(null);
            return;
        }

        if (!itemId) {
            setDataUser(null);
            setFetchError(null);
            return;
        }

        setIsLoading(true);
        setFetchError(null);

        api
            .getUserId(itemId)
            .then((res) => {
                setDataUser(res);
            })
            .catch((error) => {
                setFetchError(
                    error?.response?.data?.message || "No se pudo obtener la información del usuario."
                );
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [itemId, modalOpen]);

    if (!modalOpen) return null;

    return (
        <ModalComponent modalOpen={modalOpen} title={title} setModalOpen={setModalOpen}>
            {isLoading && (
                <div className="form__group" style={{ margin: "24px 0", textAlign: "center" }}>
                    Cargando información…
                </div>
            )}

            {fetchError && !isLoading && (
                <div className="form__group-error" style={{ margin: "24px 0" }}>
                    {fetchError}
                </div>
            )}

            {!isLoading && !fetchError && dataUser && (
                <Formik
                    enableReinitialize={true}
                    initialValues={{
                        username: dataUser.username || "",
                        email: dataUser.email || "",
                        password: "",
                        confirmPassword: "",
                        profilePicture: dataUser.profilePicture || "",
                        role: dataUser.role || "",
                    }}
                    validationSchema={EditSchemaUser}
                    onSubmit={async (values, { resetForm }) => {
                        try {
                            await api.updateUserId(itemId, values);
                            Swal.fire({
                                icon: "success",
                                title: "Usuario actualizado",
                                text: "El usuario se ha actualizado exitosamente!",
                                footer: `<h4>${values.email}</h4>`,
                            });
                            refreshList();
                            setModalOpen(false);
                            resetForm();
                        } catch (error) {
                            Swal.fire({
                                icon: "error",
                                title: "Ups!!",
                                text: `${
                                    error.response?.data?.message || "Error desconocido"
                                }`,
                            });
                            console.error(error);
                        }
                    }}
                >
                    {() => (
                        <Form className="grid-cols-2">
                            <div>
                                <div className="form__group">
                                    <label htmlFor="username" className="form__group-label">
                                        Nombre usuario
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Nombre"
                                            name="username"
                                        />
                                        <ErrorMessage
                                            name="username"
                                            component="div"
                                            className="form__group-error"
                                        />
                                    </label>
                                </div>
                                <div className="form__group">
                                    <label className="form__group-label">
                                        Email
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Email"
                                            name="email"
                                        />
                                        <ErrorMessage
                                            name="email"
                                            component="div"
                                            className="form__group-error"
                                        />
                                    </label>
                                </div>
                                <div className="form__group">
                                    <label className="form__group-label">
                                        Avatar
                                        <br />
                                        <Field
                                            type="text"
                                            className="form__group-input"
                                            placeholder="Avatar"
                                            name="profilePicture"
                                        />
                                        <ErrorMessage
                                            name="profilePicture"
                                            component="div"
                                            className="form__group-error"
                                        />
                                    </label>
                                </div>
                            </div>

                            <div>
                                <div className="form__group">
                                    <label htmlFor="role" className="form__group-label">
                                        Role
                                        <br />
                                        <Field
                                            as="select"
                                            className="form__group-input"
                                            name="role"
                                        >
                                            <option value={""}>Seleccionar</option>
                                            <option value="admin">admin</option>
                                            <option value="user">user</option>
                                        </Field>
                                        <ErrorMessage
                                            name="role"
                                            component="div"
                                            className="form__group-error"
                                        />
                                    </label>
                                </div>
                                <div className="form__group">
                                    <label className="form__group-label">
                                        Contraseña
                                        <br />
                                        <Field
                                            type="password"
                                            className="form__group-input"
                                            placeholder="Contraseña"
                                            name="password"
                                        />
                                        <ErrorMessage
                                            name="password"
                                            component="div"
                                            className="form__group-error"
                                        />
                                    </label>
                                </div>
                                <div className="form__group">
                                    <label className="form__group-label">
                                        Confirmar contraseña
                                        <br />
                                        <Field
                                            type="password"
                                            className="form__group-input"
                                            placeholder="Confirmar contraseña"
                                            name="confirmPassword"
                                        />
                                        <ErrorMessage
                                            name="confirmPassword"
                                            component="div"
                                            className="form__group-error"
                                        />
                                    </label>
                                </div>
                            </div>

                            <button type="submit" className="button btn-primary btn-adjust">
                                Actualizar
                            </button>
                        </Form>
                    )}
                </Formik>
            )}
        </ModalComponent>
    );
};

export default ModalUser;
