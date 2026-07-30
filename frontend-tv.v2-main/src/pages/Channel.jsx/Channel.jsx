import { Field, Form, Formik } from "formik";
import { Link } from "react-router-dom";
import api from "../../utils/api";
import * as Yup from "yup";
import Swal from "sweetalert2";
import { urlRegex } from "../../utils/regexValidate.js";
import { useEffect, useState } from "react";

const SchemaChannel = Yup.object().shape({
    nameChannel: Yup.string().required("Campo obligatorio"),
    numberChannelSur: Yup.string().required("Campo obligatorio"),
    numberChannelCn: Yup.string().required("Campo obligatorio"),
    logoChannel: Yup.string()
        .matches(urlRegex, "Ingrese una url válida")
        .required("Campo obligatorio"),
    severidadChannel: Yup.string().required("Campo obligatorio"),
    tipoTecnologia: Yup.string().required("Campo obligatorio"),
    tipoServicio: Yup.string().required("Campo obligatorio"),
    source: Yup.string().required("Campo obligatorio"),
});
const Channel = () => {
    const [tipoTechs, setTipoTechs] = useState([]);

    useEffect(() => {
        api.getTipoTech().then((res) => {
            setTipoTechs(res.data);
        });
    }, []);

    return (
        <>
            <div className="outlet-main">
                <nav aria-label="breadcrumb">
                    <ol className="breadcrumb">
                        <li className="breadcrumb-item">
                            <Link to="/channel-list">Listar</Link>
                        </li>
                        <li
                            className="breadcrumb-item active"
                            aria-current="page"
                        >
                            Formulario
                        </li>
                    </ol>
                </nav>
                <Formik
                    initialValues={{
                        nameChannel: "",
                        numberChannelSur: "",
                        numberChannelCn: "",
                        logoChannel: "",
                        severidadChannel: "",
                        tipoTecnologia: "",
                        tipoServicio: "",
                        source: "",
                    }}
                    validationSchema={SchemaChannel}
                    onSubmit={async (values, { resetForm }) => {
                        try {
                            await api.createSignal(values);
                            Swal.fire({
                                title: "Contacto guardado exitosamente",
                                icon: "success",
                                html: `
          <p><strong>Nombre:</strong> ${values.nameChannel}</p>
        `,
                            });
                            resetForm();
                        } catch (error) {
                            Swal.fire({
                                title: "Error",
                                icon: "error",
                                text: `Duplicidad de datos`,
                                footer: `${error.response.data.message}`,
                            });
                        }
                    }}
                >
                    {({ errors, touched }) => (
                        <Form className="form__add">
                            <h1 className="form__titulo">Registrar señal</h1>
                            <div className="rows__group">
                                <div className="columns__group">
                                    <div className="form__group">
                                        <label
                                            htmlFor="nameChannel"
                                            className="form__group-label"
                                        >
                                            Nombre señal
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Nombre señal"
                                                name="nameChannel"
                                            />
                                        </label>

                                        {errors.nameChannel &&
                                        touched.nameChannel ? (
                                            <div className="form__group-error">
                                                {errors.nameChannel}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="form__group">
                                        <label
                                            htmlFor="numberChannelSur"
                                            className="form__group-label"
                                        >
                                            Numeración sur
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Numeración sur"
                                                name="numberChannelSur"
                                            />
                                        </label>

                                        {errors.numberChannelSur &&
                                        touched.numberChannelSur ? (
                                            <div className="form__group-error">
                                                {errors.numberChannelSur}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="form__group">
                                        <label
                                            htmlFor="numberChannelCn"
                                            className="form__group-label"
                                        >
                                            Numeración norte
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Numeración norte"
                                                name="numberChannelCn"
                                            />
                                        </label>

                                        {errors.numberChannelCn &&
                                        touched.numberChannelCn ? (
                                            <div className="form__group-error">
                                                {errors.numberChannelCn}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="form__group">
                                        <label
                                            htmlFor="logoChannel"
                                            className="form__group-label"
                                        >
                                            Url logo
                                            <br />
                                            <Field
                                                type="text"
                                                className="form__group-input"
                                                placeholder="Url logo"
                                                name="logoChannel"
                                            />
                                        </label>

                                        {errors.logoChannel &&
                                        touched.logoChannel ? (
                                            <div className="form__group-error">
                                                {errors.logoChannel}
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="columns__group">
                                    <div className="form__group">
                                        <label
                                            htmlFor="tipoServicio"
                                            className="form__group-label"
                                        >
                                            Tipo Servicio
                                            <br />
                                            <Field
                                                as="select"
                                                className="form__group-input"
                                                name="tipoServicio"
                                            >
                                                <option value={"0"}>
                                                    --Seleccionar--
                                                </option>
                                                <option value={"Radio"}>
                                                    Radio
                                                </option>
                                                <option value={"TV"}>TV</option>
                                            </Field>
                                        </label>

                                        {errors.tipoServicio &&
                                        touched.tipoServicio ? (
                                            <div className="form__group-error">
                                                {errors.tipoServicio}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="form__group">
                                        <label
                                            htmlFor="severidadChannel"
                                            className="form__group-label"
                                        >
                                            Severidad
                                            <br />
                                            <Field
                                                as="select"
                                                className="form__group-input"
                                                name="severidadChannel"
                                            >
                                                <option value={"0"}>
                                                    --Seleccionar--
                                                </option>
                                                <option value={"1"}>1</option>
                                                <option value={"2"}>2</option>
                                                <option value={"3"}>3</option>
                                                <option value={"4"}>4</option>
                                            </Field>
                                        </label>

                                        {errors.severidadChannel &&
                                        touched.severidadChannel ? (
                                            <div className="form__group-error">
                                                {errors.severidadChannel}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="form__group">
                                        <label
                                            htmlFor="tipoTecnologia"
                                            className="form__group-label"
                                        >
                                            Tipo tecnología
                                            <br />
                                            <Field
                                                as="select"
                                                className="form__group-input"
                                                name="tipoTecnologia"
                                            >
                                                <option value={""}>
                                                    --Seleccionar--
                                                </option>
                                                {tipoTechs.map((t, i) => (
                                                    <option
                                                        key={`${
                                                            t?._id ?? "tipoTech"
                                                        }-${i}`} // fallback con índice
                                                        value={(
                                                            t?.nombreTipo ?? ""
                                                        ).toUpperCase()}
                                                    >
                                                        {(
                                                            t?.nombreTipo ?? ""
                                                        ).toUpperCase()}
                                                    </option>
                                                ))}
                                            </Field>
                                        </label>

                                        {errors.tipoTecnologia &&
                                        touched.tipoTecnologia ? (
                                            <div className="form__group-error">
                                                {errors.tipoTecnologia}
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="form__group">
                                        <label
                                            htmlFor="source"
                                            className="form__group-label"
                                        >
                                            Origen
                                            <br />
                                            <Field
                                                as="select"
                                                className="form__group-input"
                                                name="source"
                                            >
                                                <option value={"0"}>
                                                    --Seleccionar--
                                                </option>
                                                <option value={"STGO"}>
                                                    Santiago
                                                </option>
                                                <option value={"VLDV"}>
                                                    Valdivia
                                                </option>
                                            </Field>
                                        </label>

                                        {errors.source && touched.source ? (
                                            <div className="form__group-error">
                                                {errors.source}
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
                    )}
                </Formik>
            </div>
        </>
    );
};

export default Channel;
