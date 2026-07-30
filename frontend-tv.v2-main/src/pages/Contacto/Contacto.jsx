import { Field, Form, Formik } from "formik";
import { Link } from "react-router-dom";
import api from "../../utils/api";
import * as Yup from "yup";
import Swal from "sweetalert2";
import { otherEmail, phoneValidate } from "../../utils/regexValidate.js";

const SchemaContacto = Yup.object().shape({
  nombreContact: Yup.string().required("Campo obligatorio"),
  email: Yup.string().matches(otherEmail, "Debe ser un correo válido"),
  telefono: Yup.string().matches(
    phoneValidate,
    "Debe ser un telefono válido"
  ),
});

const Contacto = () => {
  return (
    <>
      <div className="outlet-main">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb">
            <li className="breadcrumb-item">
              <Link to="/contact-list">Listar</Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Formulario
            </li>
          </ol>
        </nav>
        <Formik
          initialValues={{
            nombreContact: "",
            email: "",
            telefono: "",
          }}
          validationSchema={SchemaContacto}
          onSubmit={async (values, { resetForm }) => {
            try {
              await api.createContact(values);

              Swal.fire({
                title: "Contacto guardado exitosamente",
                icon: "success",
                html: `<p><strong>Nombre:</strong> ${values.nombreContact}</p>`,
              });
              resetForm();
            } catch (error) {
              const status = error?.response?.status;
              const msg =
                error?.response?.data?.message ||
                "Error al crear contacto";

              if (status === 409) {
                // Duplicidad (índice unique)
                Swal.fire({
                  title: "Error",
                  icon: "error",
                  text: "Duplicidad de datos",
                  footer: msg,
                });
              } else {
                Swal.fire({
                  title: "Error",
                  icon: "error",
                  text: msg,
                  footer: "Error al crear contacto",
                });
              }
            }
          }}
        >
          {({ errors, touched, setFieldValue }) => (
            <Form className="form__add">
              <h1 className="form__titulo">Registrar contacto</h1>
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
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          setFieldValue(
                            "nombreContact",
                            value.replace(/\s+/g, " ")
                          );
                        }}
                      />
                    </label>
                    {errors.nombreContact &&
                      touched.nombreContact && (
                        <div className="form__group-error">
                          {errors.nombreContact}
                        </div>
                      )}
                  </div>

                  <div className="form__group">
                    <label htmlFor="email" className="form__group-label">
                      Email
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Email"
                        name="email"
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          setFieldValue(
                            "email",
                            value.replace(/\s+/g, "")
                          );
                        }}
                      />
                    </label>
                    {errors.email && touched.email && (
                      <div className="form__group-error">
                        {errors.email}
                      </div>
                    )}
                  </div>

                  <div className="form__group">
                    <label htmlFor="telefono" className="form__group-label">
                      Teléfono
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Teléfono"
                        name="telefono"
                        onBlur={(e) => {
                          const value = e.target.value.trim();
                          setFieldValue(
                            "telefono",
                            value.replace(/\s+/g, "")
                          );
                        }}
                      />
                    </label>
                    {errors.telefono && touched.telefono && (
                      <div className="form__group-error">
                        {errors.telefono}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button type="submit" className={`button btn-primary`}>
                Enviar
              </button>
            </Form>
          )}
        </Formik>
      </div>
    </>
  );
};

export default Contacto;
