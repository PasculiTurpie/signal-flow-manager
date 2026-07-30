import React, { useEffect, useMemo, useState } from "react";
import { Field, Form, Formik } from "formik";
import { Link } from "react-router-dom";
import * as Yup from "yup";
import Swal from "sweetalert2";

import api from "../../utils/api";
import stylesEquipment from "../Equipment/Equipment.module.css";

const SchemaTipoEquipos = Yup.object().shape({
  tipoNombre: Yup.string()
    .trim("No debe tener espacios al inicio o al final")
    .required("Campo obligatorio"),
});

// helper: normaliza igual que backend
const normalizeTipo = (s = "") => s.trim().toLowerCase();

const TipoEquipoForm = () => {
  const [tipoEquipments, setTipoEquipments] = useState([]);

  const fetchTipos = async () => {
    try {
      const { data } = await api.getTipoEquipo();
      setTipoEquipments(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn("Error getTipoEquipo:", e?.response?.data || e?.message);
      setTipoEquipments([]);
    }
  };

  useEffect(() => {
    fetchTipos();
  }, []);

  // Set con nombres normalizados para detectar duplicados rápido
  const tiposSet = useMemo(() => {
    const set = new Set();
    for (const t of tipoEquipments || []) {
      const key = normalizeTipo(t?.tipoNombre || "");
      if (key) set.add(key);
    }
    return set;
  }, [tipoEquipments]);

  return (
    <div className="outlet-main">
      <nav aria-label="breadcrumb">
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link to="/list-type-equitment">Listar</Link>
          </li>
          <li className="breadcrumb-item active" aria-current="page">
            Formulario
          </li>
        </ol>
      </nav>

      <div className={stylesEquipment.tipo__section}>
        <hr className={stylesEquipment.section__divider} />

        <Formik
          initialValues={{ tipoNombre: "" }}
          validationSchema={SchemaTipoEquipos}
          validate={(values) => {
            const errors = {};
            const normalized = normalizeTipo(values.tipoNombre);

            // si está vacío, Yup se encargará; acá solo validamos duplicado
            if (normalized && tiposSet.has(normalized)) {
              errors.tipoNombre = "Ese tipo de equipo ya existe";
            }
            return errors;
          }}
          onSubmit={async (values, { resetForm, setSubmitting }) => {
            const normalized = normalizeTipo(values.tipoNombre);

            // doble-check por si cambió la lista entre medio
            if (tiposSet.has(normalized)) {
              Swal.fire({
                title: "Duplicado",
                icon: "warning",
                text: `El tipo "${normalized}" ya existe.`,
              });
              return;
            }

            try {
              setSubmitting(true);
              await api.createTipoEquipo({ tipoNombre: normalized });

              Swal.fire({
                title: "Tipo de equipo guardado exitosamente",
                icon: "success",
                html: `<p><strong>Tipo:</strong> ${normalized}</p>`,
              });

              resetForm();
              await fetchTipos(); // refresca lista para próximos submits
            } catch (error) {
              // si el backend tiene índice único, aquí suele venir E11000
              Swal.fire({
                title: "Error",
                icon: "error",
                text: "No se pudo guardar (posible duplicidad).",
                footer: `${error.response?.data?.message || "Error desconocido"}`,
              });
            } finally {
              setSubmitting(false);
            }
          }}
        >
          {({ errors, touched, isSubmitting }) => (
            <Form className="form__add">
              <h1 className="form__titulo">Registrar Tipo Equipo</h1>

              <div className={stylesEquipment.rows__group}>
                <div className={stylesEquipment.columns__group}>
                  <div className="form__group">
                    <label htmlFor="tipoNombre" className="form__group-label">
                      Tipo equipo
                      <br />
                      <Field
                        type="text"
                        className="form__group-input"
                        placeholder="Tipo equipo"
                        name="tipoNombre"
                      />
                    </label>

                    {errors.tipoNombre && touched.tipoNombre && (
                      <div className="form__group-error">{errors.tipoNombre}</div>
                    )}
                  </div>
                </div>
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
    </div>
  );
};

export default TipoEquipoForm;
