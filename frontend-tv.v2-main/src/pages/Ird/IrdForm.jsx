// pages/Ird/IrdForm.jsx
import { Formik, Field, Form } from "formik";
import { Link } from "react-router-dom";
import * as Yup from "yup";
import Swal from "sweetalert2";

import styles from "./Ird.module.css";
import "../../styles.css";
import api from "../../utils/api";
import { ipMulticastRegex, ipVideoMulticast } from "../../utils/regexValidate";

// ------------------------ VALIDACIONES ------------------------
const IrdSchema = Yup.object().shape({
  nombreIrd: Yup.string().required("Campo obligatorio"),
  ipAdminIrd: Yup.string()
    .required("Campo obligatorio")
    .matches(/^172\.19\.\d{1,3}\.\d{1,3}$/, "Ingresa una ip válida"),
  marcaIrd: Yup.string().required("Campo obligatorio"),
  modelIrd: Yup.string().required("Campo obligatorio"),
  versionIrd: Yup.string().required("Campo obligatorio"),
  uaIrd: Yup.string().required("Campo obligatorio"),
  tidReceptor: Yup.string().required("Campo obligatorio"),
  typeReceptor: Yup.string().required("Campo obligatorio"),
  feqReceptor: Yup.string().required("Campo obligatorio"),
  symbolRateIrd: Yup.string().required("Campo obligatorio"),
  fecReceptorIrd: Yup.string().required("Campo obligatorio"),
  modulationReceptorIrd: Yup.string().required("Campo obligatorio"),
  rellOfReceptor: Yup.string().required("Campo obligatorio"),
  nidReceptor: Yup.string().required("Campo obligatorio"),
  cvirtualReceptor: Yup.string().required("Campo obligatorio"),
  vctReceptor: Yup.string().required("Campo obligatorio"),
  outputReceptor: Yup.string().required("Campo obligatorio"),
  swAdmin: Yup.string(),
  portSw: Yup.string(),
  multicastReceptor: Yup.string()
    .matches(ipMulticastRegex, "Debe ser una multicast válida")
    .required("Campo requerido"),
  ipVideoMulticast: Yup.string()
    .required("Campo obligatorio")
    .matches(ipVideoMulticast, "Debe ser una ip válida"),
  locationRow: Yup.string()
    .required("Campo obligatorio")
    .matches(/\d+/, "Ingrese un número"),
  locationCol: Yup.string()
    .required("Campo obligatorio")
    .matches(/\d+/, "Ingrese un número"),
});

// ------------------------ COMPONENTE ------------------------
const IrdForm = () => {
  return (
    <>
      <div className="outlet-main">
        <nav aria-label="breadcrumb">
          <ol className="breadcrumb">
            <li className="breadcrumb-item">
              <Link to="/listar-ird">Listar</Link>
            </li>
            <li className="breadcrumb-item active" aria-current="page">
              Formulario
            </li>
          </ol>
        </nav>

        <Formik
          initialValues={{
            nombreIrd: "",
            ipAdminIrd: "",
            marcaIrd: "",
            modelIrd: "",
            versionIrd: "",
            uaIrd: "",
            tidReceptor: "",
            typeReceptor: "",
            feqReceptor: "",
            symbolRateIrd: "",
            fecReceptorIrd: "",
            modulationReceptorIrd: "",
            rellOfReceptor: "",
            nidReceptor: "",
            cvirtualReceptor: "",
            vctReceptor: "",
            outputReceptor: "",
            swAdmin: "",
            portSw: "",
            multicastReceptor: "",
            ipVideoMulticast: "",
            locationRow: "",
            locationCol: "",
          }}
          validationSchema={IrdSchema}
          enableReinitialize={true}
          onSubmit={async (values, { resetForm, setSubmitting }) => {
            try {
              setSubmitting(true);

              // ✅ Normaliza strings (evita choque por espacios)
              const payload = Object.fromEntries(
                Object.entries(values).map(([k, v]) => [
                  k,
                  typeof v === "string" ? v.trim() : v,
                ])
              );

              

              // api.createIrd() ya devuelve r.data
              const data = await api.createIrd(payload);

              

              const ird = data?.ird ?? data;
              const equipo = data?.equipo ?? null;
              const equipoInfo = data?.equipoInfo ?? null;

              const tipoEquipoNombreRaw =
                equipo?.tipoNombre?.tipoNombre ||
                equipo?.tipoNombre?.tipoNombreLower ||
                equipoInfo?.tipoEquipo ||
                null;

              const tipoEquipoNombre = tipoEquipoNombreRaw
                ? String(tipoEquipoNombreRaw).toUpperCase()
                : "NO INFORMADO";

              const equipoEstado = equipo
                ? "Creado/Actualizado"
                : equipoInfo?.created === false
                ? "No creado"
                : "No informado";

              const motivoEquipo =
                equipoInfo?.reason ||
                (equipo ? "Equipo asociado creado automáticamente." : "");

              Swal.fire({
                title: "IRD guardado",
                icon: "success",
                html: `
                  <div style="text-align:left">
                    <div><b>Nombre IRD:</b> ${payload.nombreIrd}</div>
                    <div><b>Marca:</b> ${payload.marcaIrd}</div>
                    <div><b>Modelo:</b> ${payload.modelIrd}</div>
                    <div><b>IP Gestión:</b> ${payload.ipAdminIrd}</div>
                    <hr/>
                    <div><b>Equipo:</b> ${equipoEstado}</div>
                    <div><b>TipoEquipo:</b> ${tipoEquipoNombre}</div>
                    ${
                      motivoEquipo
                        ? `<div style="margin-top:6px;"><b>Detalle:</b> ${motivoEquipo}</div>`
                        : ""
                    }
                    ${
                      ird?._id
                        ? `<div style="margin-top:8px;"><b>IRD _id:</b> ${ird._id}</div>`
                        : ""
                    }
                    ${
                      equipo?._id
                        ? `<div><b>Equipo _id:</b> ${equipo._id}</div>`
                        : ""
                    }
                  </div>
                `,
              });

              resetForm();
            } catch (error) {
              // ✅ Logs completos del error Axios
              console.error("[IRD][CREATE] Error completo:", error);
              
              
              
              

              const status = error?.response?.status ?? "N/A";
              const message =
                error?.response?.data?.message ||
                error?.message ||
                "Error desconocido";
              const detail = error?.response?.data?.detail;

              Swal.fire({
                title: "Error",
                icon: "error",
                html: `
                  <div style="text-align:left">
                    <div><b>Status:</b> ${status}</div>
                    <div><b>Mensaje:</b> ${String(message)}</div>
                    ${
                      detail
                        ? `<div style="margin-top:8px;"><b>Detail:</b><pre style="white-space:pre-wrap">${JSON.stringify(
                            detail,
                            null,
                            2
                          )}</pre></div>`
                        : ""
                    }
                    <div style="margin-top:8px;"><b>RAW response.data:</b></div>
                    <pre style="white-space:pre-wrap">${JSON.stringify(
                      error?.response?.data ?? {},
                      null,
                      2
                    )}</pre>
                  </div>
                `,
              });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ errors, touched, isSubmitting }) => (
            <Form className={`form__add ${styles.formGrid}`}>
              <h1 className="form__titulo">Ingresa un IRD</h1>

              <div className={styles.rows__group}>
                {/* COLUMNA 1 */}
                <div className={styles.columns__group}>
                  <div className="form__group">
                    <label htmlFor="nombreIrd" className="form__group-label">
                      Nombre
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Nombre IRD"
                        name="nombreIrd"
                      />
                    </label>
                    {errors.nombreIrd && touched.nombreIrd ? (
                      <div className="form__group-error">
                        {errors.nombreIrd}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label htmlFor="marcaIrd" className="form__group-label">
                      Marca
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Marca"
                        name="marcaIrd"
                      />
                    </label>
                    {errors.marcaIrd && touched.marcaIrd ? (
                      <div className="form__group-error">
                        {errors.marcaIrd}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label htmlFor="modelIrd" className="form__group-label">
                      Modelo
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Modelo"
                        name="modelIrd"
                      />
                    </label>
                    {errors.modelIrd && touched.modelIrd ? (
                      <div className="form__group-error">
                        {errors.modelIrd}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label htmlFor="ipAdminIrd" className="form__group-label">
                      IP administración
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="172.19.x.x"
                        name="ipAdminIrd"
                      />
                    </label>
                    {errors.ipAdminIrd && touched.ipAdminIrd ? (
                      <div className="form__group-error">
                        {errors.ipAdminIrd}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label htmlFor="versionIrd" className="form__group-label">
                      Versión
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Versión"
                        name="versionIrd"
                      />
                    </label>
                    {errors.versionIrd && touched.versionIrd ? (
                      <div className="form__group-error">
                        {errors.versionIrd}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label htmlFor="uaIrd" className="form__group-label">
                      UA
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="UA"
                        name="uaIrd"
                      />
                    </label>
                    {errors.uaIrd && touched.uaIrd ? (
                      <div className="form__group-error">
                        {errors.uaIrd}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* COLUMNA 2 */}
                <div className={styles.columns__group}>
                  <div className="form__group">
                    <label htmlFor="tidReceptor" className="form__group-label">
                      TID
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="TID"
                        name="tidReceptor"
                      />
                    </label>
                    {errors.tidReceptor && touched.tidReceptor ? (
                      <div className="form__group-error">
                        {errors.tidReceptor}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label htmlFor="typeReceptor" className="form__group-label">
                      Tipo receptor
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Tipo"
                        name="typeReceptor"
                      />
                    </label>
                    {errors.typeReceptor && touched.typeReceptor ? (
                      <div className="form__group-error">
                        {errors.typeReceptor}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label htmlFor="feqReceptor" className="form__group-label">
                      Frecuencia
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Frecuencia"
                        name="feqReceptor"
                      />
                    </label>
                    {errors.feqReceptor && touched.feqReceptor ? (
                      <div className="form__group-error">
                        {errors.feqReceptor}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label
                      htmlFor="symbolRateIrd"
                      className="form__group-label"
                    >
                      Symbol Rate
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Symbol Rate"
                        name="symbolRateIrd"
                      />
                    </label>
                    {errors.symbolRateIrd && touched.symbolRateIrd ? (
                      <div className="form__group-error">
                        {errors.symbolRateIrd}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label
                      htmlFor="fecReceptorIrd"
                      className="form__group-label"
                    >
                      FEC
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="FEC"
                        name="fecReceptorIrd"
                      />
                    </label>
                    {errors.fecReceptorIrd && touched.fecReceptorIrd ? (
                      <div className="form__group-error">
                        {errors.fecReceptorIrd}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label htmlFor="swAdmin" className="form__group-label">
                      SW Admin
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="SW Admin"
                        name="swAdmin"
                      />
                    </label>
                    {errors.swAdmin && touched.swAdmin ? (
                      <div className="form__group-error">
                        {errors.swAdmin}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* COLUMNA 3 */}
                <div className={styles.columns__group}>
                  <div className="form__group">
                    <label
                      htmlFor="modulationReceptorIrd"
                      className="form__group-label"
                    >
                      Modulación
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Modulación"
                        name="modulationReceptorIrd"
                      />
                    </label>
                    {errors.modulationReceptorIrd &&
                    touched.modulationReceptorIrd ? (
                      <div className="form__group-error">
                        {errors.modulationReceptorIrd}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label
                      htmlFor="rellOfReceptor"
                      className="form__group-label"
                    >
                      Roll Off
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Roll Off"
                        name="rellOfReceptor"
                      />
                    </label>
                    {errors.rellOfReceptor && touched.rellOfReceptor ? (
                      <div className="form__group-error">
                        {errors.rellOfReceptor}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label htmlFor="nidReceptor" className="form__group-label">
                      NID
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="NID"
                        name="nidReceptor"
                      />
                    </label>
                    {errors.nidReceptor && touched.nidReceptor ? (
                      <div className="form__group-error">
                        {errors.nidReceptor}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label
                      htmlFor="cvirtualReceptor"
                      className="form__group-label"
                    >
                      Canal Virtual
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Canal Virtual"
                        name="cvirtualReceptor"
                      />
                    </label>
                    {errors.cvirtualReceptor && touched.cvirtualReceptor ? (
                      <div className="form__group-error">
                        {errors.cvirtualReceptor}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label htmlFor="vctReceptor" className="form__group-label">
                      VCT
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="VCT"
                        name="vctReceptor"
                      />
                    </label>
                    {errors.vctReceptor && touched.vctReceptor ? (
                      <div className="form__group-error">
                        {errors.vctReceptor}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label htmlFor="portSw" className="form__group-label">
                      SW Port
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Puerto"
                        name="portSw"
                      />
                    </label>
                    {errors.portSw && touched.portSw ? (
                      <div className="form__group-error">
                        {errors.portSw}
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* COLUMNA 4 */}
                <div className={styles.columns__group}>
                  <div className="form__group">
                    <label
                      htmlFor="outputReceptor"
                      className="form__group-label"
                    >
                      Salida receptor
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Salida"
                        name="outputReceptor"
                      />
                    </label>
                    {errors.outputReceptor && touched.outputReceptor ? (
                      <div className="form__group-error">
                        {errors.outputReceptor}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label
                      htmlFor="multicastReceptor"
                      className="form__group-label"
                    >
                      Multicast Receptor
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Multicast"
                        name="multicastReceptor"
                      />
                    </label>
                    {errors.multicastReceptor && touched.multicastReceptor ? (
                      <div className="form__group-error">
                        {errors.multicastReceptor}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label
                      htmlFor="ipVideoMulticast"
                      className="form__group-label"
                    >
                      Ip Video Multicast
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="IP Video"
                        name="ipVideoMulticast"
                      />
                    </label>
                    {errors.ipVideoMulticast && touched.ipVideoMulticast ? (
                      <div className="form__group-error">
                        {errors.ipVideoMulticast}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label htmlFor="locationRow" className="form__group-label">
                      Fila
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Fila"
                        name="locationRow"
                      />
                    </label>
                    {errors.locationRow && touched.locationRow ? (
                      <div className="form__group-error">
                        {errors.locationRow}
                      </div>
                    ) : null}
                  </div>

                  <div className="form__group">
                    <label htmlFor="locationCol" className="form__group-label">
                      Bastidor
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Bastidor"
                        name="locationCol"
                      />
                    </label>
                    {errors.locationCol && touched.locationCol ? (
                      <div className="form__group-error">
                        {errors.locationCol}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Guardando..." : "Enviar"}
              </button>
            </Form>
          )}
        </Formik>
      </div>
    </>
  );
};

export default IrdForm;
