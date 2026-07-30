import { Form, Formik } from "formik";
import { useEffect, useState } from "react";
import Select from "react-select";
import api from "../../utils/api";
import * as Yup from "yup";
import Swal from "sweetalert2";

const UpdateContactSignal = Yup.object().shape({
    nameChannel: Yup.object().nullable().required("Campo obligatorio"),
    contact: Yup.array()
        .of(Yup.object().nullable())
        .min(1, "Selecciona al menos un contacto")
        .required("Campo obligatorio"),
});

const selectMenuPortalTarget = typeof document !== "undefined" ? document.body : null;

const SignalContact = () => {
    const [optionsSignal, setOptionsSignal] = useState([]);
    const [optionsContact, setOptionsContact] = useState([]);

    const getAllSignal = () => {
        api.getSignal().then((res) => {
            const optSignal = (res?.data ?? []).map((signal) => {
                const label = signal?.nameChannel
                    ? `${signal.nameChannel} ${signal?.tipoTecnologia ? String(signal.tipoTecnologia).toUpperCase() : ""}`
                    : "Canal sin nombre";
                return { value: signal._id, label };
            });
            setOptionsSignal(optSignal);
        });
    };

    const getAllContact = () => {
        api.getContact().then((res) => {
            const optContact = (res?.data ?? [])
                .filter((c) => c?.nombreContact && c.nombreContact.trim() !== "")
                .map((c) => ({ value: c._id, label: c.nombreContact }));
            setOptionsContact(optContact);
        });
    };

    useEffect(() => {
        getAllSignal();
        getAllContact();
    }, []);

    const handleSubmit = async (values) => {
        try {
            await api.updateSignal(values.nameChannel.value, {
                contact: (values.contact ?? []).map((c) => c.value),
            });
            Swal.fire({ icon: "success", title: "Asignado exitosamente" });
        } catch (error) {
            Swal.fire({
                icon: "error",
                title: "Error",
                text: error?.response?.data?.message || "Error desconocido",
            });
        }
    };

    return (
        <div className="outlet-main">
            <Formik
                initialValues={{ nameChannel: null, contact: [] }}
                validationSchema={UpdateContactSignal}
                onSubmit={handleSubmit}
            >
                {({ setFieldValue, values, errors, touched }) => (
                    <Form className="form__add">
                        <h1 className="form__titulo">Asignar contactos</h1>

                        <div className="rows__group rows__group--auto">
                            {/* Canal */}
                            <div className="columns__group">
                                <div className={`form__group ${errors.nameChannel && touched.nameChannel ? "has-error" : ""}`}>
                                    <label className="form__group-label">Nombre canal</label>
                                    <Select
                                        className="form__select"
                                        classNamePrefix="rs"
                                        name="nameChannel"
                                        options={optionsSignal}
                                        placeholder="Nombre canal"
                                        value={values.nameChannel}
                                        onChange={(option) => setFieldValue("nameChannel", option)}
                                        isSearchable
                                        isClearable
                                        menuPlacement="auto"
                                        menuPortalTarget={selectMenuPortalTarget}
                                    />
                                    {errors.nameChannel && touched.nameChannel && (
                                        <div className="form__group-error">{errors.nameChannel}</div>
                                    )}
                                </div>
                            </div>

                            {/* Contactos */}
                            <div className="columns__group">
                                <div className={`form__group ${errors.contact && touched.contact ? "has-error" : ""}`}>
                                    <label className="form__group-label">Contacto</label>
                                    <Select
                                        className="form__select"
                                        classNamePrefix="rs"
                                        name="contact"
                                        options={optionsContact}
                                        placeholder="Selecciona contactos"
                                        value={values.contact}
                                        onChange={(selected) => setFieldValue("contact", selected || [])}
                                        isMulti
                                        isSearchable
                                        closeMenuOnSelect={false}
                                        isClearable
                                        menuPlacement="auto"
                                        menuPortalTarget={selectMenuPortalTarget}
                                    />
                                    {errors.contact && touched.contact && (
                                        <div className="form__group-error">{errors.contact}</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="form__actions">
                            <button type="submit" className="button btn-primary">Añadir</button>
                        </div>
                    </Form>
                )}
            </Formik>
        </div>
    );
};

export default SignalContact;
