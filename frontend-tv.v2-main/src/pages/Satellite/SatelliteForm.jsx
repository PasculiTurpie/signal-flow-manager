// src/pages/Satellite/SatelliteForm.jsx
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";
import Swal from "sweetalert2";
import api from "../../utils/api";
import "../../components/styles/theme.css";
import "../../components/styles/forms.css";
import "../../components/styles/tables.css";

const SatelliteSchema = Yup.object().shape({
  satelliteName: Yup.string().trim().required("Campo obligatorio"),
  satelliteUrl: Yup.string()
    .trim()
    .test(
      "starts-with-http",
      "La URL debe comenzar con http:// o https://",
      (value) => value?.startsWith("http://") || value?.startsWith("https://")
    )
    .url("Debe ser una URL válida")
    .required("La URL es obligatoria"),
  satelliteType: Yup.string()
    .notOneOf(["0", "default", ""], "Debes seleccionar una opción válida.")
    .required("Campo obligatorio"),
});

const normalizeArray = (resp) => {
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp?.data)) return resp.data;
  return [];
};

const getErrMsg = (e) =>
  e?.response?.data?.message ||
  e?.response?.data?.error ||
  e?.message ||
  "Error desconocido";

const SatelliteForm = () => {
  const [polarizations, setPolarizations] = useState([]);
  const [tipoMap, setTipoMap] = useState({});
  const [loadingTipos, setLoadingTipos] = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resp = await api.getPolarizations();
        const arr = normalizeArray(resp);
        if (mounted) setPolarizations(arr);
      } catch (e) {
        console.error("Error fetching polarization data:", e);
        if (mounted) setPolarizations([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingTipos(true);
        const res = await api.getTipoEquipo();
        const arr = normalizeArray(res);
        const map = {};
        for (const t of arr) {
          const id = t?.id || t?._id; // soporte backend
          if (t?.tipoNombre && id) {
            map[String(t.tipoNombre).toLowerCase().trim()] = id;
          }
        }
        if (mounted) setTipoMap(map);
      } catch (err) {
        console.warn("No se pudo cargar TipoEquipo:", err?.response?.data || err);
      } finally {
        if (mounted) setLoadingTipos(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ✅ Si existe el TipoEquipo, NO se crea
  const ensureTipoId = async (name = "satelite") => {
    const key = String(name).toLowerCase().trim();

    if (tipoMap[key]) return tipoMap[key];

    const res1 = await api.getTipoEquipo();
    const arr1 = normalizeArray(res1);
    const found1 = arr1.find(
      (t) => String(t?.tipoNombre).toLowerCase().trim() === key
    );

    const foundId1 = found1?.id || found1?._id;
    if (foundId1) {
      setTipoMap((prev) => ({ ...prev, [key]: foundId1 }));
      return foundId1;
    }

    const created = await api.createTipoEquipo({ tipoNombre: name });
    const createdId = created?.id || created?._id;
    if (createdId) {
      setTipoMap((prev) => ({ ...prev, [key]: createdId }));
      return createdId;
    }

    throw new Error("No existe ni se pudo crear el TipoEquipo 'satelite'.");
  };

  return (
    <div className="outlet-main">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link to="/listar-satelite">Listar</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            Formulario
          </li>
        </ol>
      </nav>

      <Formik
        initialValues={{ satelliteName: "", satelliteUrl: "", satelliteType: "" }}
        validationSchema={SatelliteSchema}
        onSubmit={async (values, { resetForm, setSubmitting }) => {
          if (loadingTipos) {
            Swal.fire({
              icon: "info",
              title: "Cargando tipos…",
              text: "Espera y reintenta.",
            });
            return;
          }

          setSubmitting(true);
          let satId = null;

          try {
            const payloadSat = {
              satelliteName: values.satelliteName.trim(),
              satelliteUrl: values.satelliteUrl.trim(),
              satelliteType: values.satelliteType,
            };

            const sat = await api.createSatelite(payloadSat);
            satId = sat?._id;

            const tipoSatId = await ensureTipoId("satelite");

            const payloadEquipo = {
              nombre: values.satelliteName.trim(),
              marca: "SAT",
              modelo: "GENERIC",
              tipoNombre: tipoSatId,
              satelliteRef: satId,
            };

            await api.createEquipo(payloadEquipo);

            await Swal.fire({
              title: "Satélite guardado",
              icon: "success",
            });

            resetForm();
            nameInputRef.current?.focus();
          } catch (error) {
            if (satId) {
              await api.deleteSatelliteId(satId);
            }

            Swal.fire({
              title: "Error",
              icon: "error",
              text: "No se pudo completar la creación Satélite + Equipo.",
              footer: getErrMsg(error),
            });
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ errors, touched, isSubmitting }) => (
          <Form className="form__add">
            <h1 className="form__titulo">Ingresa un satélite</h1>

            <div className="form__group">
              <label className="form__group-label">
                Nombre de Satélite
                <Field
                  innerRef={nameInputRef}
                  type="text"
                  className="form__group-input"
                  name="satelliteName"
                />
              </label>
              {errors.satelliteName && touched.satelliteName && (
                <div className="form__group-error">{errors.satelliteName}</div>
              )}
            </div>

            <div className="form__group">
              <label className="form__group-label">
                Url web
                <Field
                  type="text"
                  className="form__group-input"
                  name="satelliteUrl"
                />
              </label>
              {errors.satelliteUrl && touched.satelliteUrl && (
                <div className="form__group-error">{errors.satelliteUrl}</div>
              )}
            </div>

            <div className="form__group">
              <label className="form__group-label">
                Selecciona la polaridad
                <Field
                  as="select"
                  className="form__group-input"
                  name="satelliteType"
                >
                  <option value={"0"}>--Seleccionar--</option>
                  {(polarizations || []).map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.typePolarization}
                    </option>
                  ))}
                </Field>
              </label>
              {errors.satelliteType && touched.satelliteType && (
                <div className="form__group-error">{errors.satelliteType}</div>
              )}
            </div>

            <button
              type="submit"
              className="button btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Guardando..." : "Enviar"}
            </button>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default SatelliteForm;
