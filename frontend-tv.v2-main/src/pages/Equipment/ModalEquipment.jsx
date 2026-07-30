import React, { useEffect, useState } from "react";
import api from "../../utils/api";
import { Formik, Form, Field, ErrorMessage } from "formik";
import * as Yup from "yup";
import Swal from "sweetalert2";
import ModalComponent from "../../components/ModalComponent/ModalComponent";
import { ipGestionRegex } from "../../utils/regexValidate";
import stylesEquipment from "./Equipment.module.css";

const UpdateSchemaEquipo = Yup.object().shape({
  nombre: Yup.string().trim().required("Nombre requerido"),
  marca: Yup.string().trim().required("Marca requerida"),
  modelo: Yup.string().trim().required("Modelo requerido"),
  tipoNombre: Yup.string().trim().required("Tipo requerido"), // aquí viaja el _id
  ip_gestion: Yup.string()
    .trim()
    .matches(ipGestionRegex, "Debe ser una IP válida")
    .required("IP requerida"),
});

const ModalEquipment = ({ itemId, modalOpen, setModalOpen, title, refreshList }) => {
  const [dataEquipos, setDataEquipos] = useState(null);
  const [tiposEquipo, setTiposEquipo] = useState([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        if (itemId) {
          const resEquipo = await api.getIdEquipo(itemId);
          if (mounted) setDataEquipos(resEquipo.data);
        }

        const resTipos = await api.getTipoEquipo();
        if (mounted) setTiposEquipo(resTipos.data || []);
      } catch (err) {
        console.error("Error cargando modal equipo:", err);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [itemId]);

  if (!dataEquipos) return null;

  return (
    <Formik
      enableReinitialize
      initialValues={{
        nombre: dataEquipos.nombre || "",
        marca: dataEquipos.marca || "",
        modelo: dataEquipos.modelo || "",
        // ✅ FIX: usar el _id del tipo
        tipoNombre: dataEquipos?.tipoNombre?._id || "",
        ip_gestion: dataEquipos.ip_gestion || "",
      }}
      validationSchema={UpdateSchemaEquipo}
      onSubmit={async (values, { resetForm }) => {
        try {
          await api.updateEquipo(itemId, values);

          Swal.fire({
            icon: "success",
            title: "Equipo actualizado",
            text: "El equipo se ha actualizado exitosamente!",
            footer: `<h4>${values.nombre}</h4><h4>${values.ip_gestion}</h4>`,
          });

          refreshList?.();
          setModalOpen(false);
          resetForm();
        } catch (error) {
          Swal.fire({
            icon: "error",
            title: "Ups!!",
            text: `${error.response?.data?.message || "Error desconocido"}`,
          });
          console.error("Error al actualizar equipo:", error.response || error.message || error);
        }
      }}
    >
      {() => (
        <ModalComponent modalOpen={modalOpen} title={title} setModalOpen={setModalOpen}>
          <Form className={stylesEquipment.form__add}>
            <div className={stylesEquipment.rows__group}>
              <div className={stylesEquipment.columns__group}>
                <div className="form__group">
                  <label htmlFor="nombre" className="form__group-label">
                    Nombre
                    <br />
                    <Field type="text" className="form__group-input" placeholder="Nombre" name="nombre" />
                  </label>
                  <ErrorMessage name="nombre" component="div" className="form__group-error" />
                </div>

                <div className="form__group">
                  <label htmlFor="marca" className="form__group-label">
                    Marca
                    <br />
                    <Field type="text" className="form__group-input" placeholder="Marca" name="marca" />
                  </label>
                  <ErrorMessage name="marca" component="div" className="form__group-error" />
                </div>

                <div className="form__group">
                  <label htmlFor="modelo" className="form__group-label">
                    Modelo
                    <br />
                    <Field type="text" className="form__group-input" placeholder="Modelo" name="modelo" />
                  </label>
                  <ErrorMessage name="modelo" component="div" className="form__group-error" />
                </div>
              </div>

              <div className={stylesEquipment.columns__group}>
                <div className="form__group">
                  <label htmlFor="tipoNombre" className="form__group-label">
                    Tipo equipo
                    <br />
                    <Field as="select" className="form__group-input" name="tipoNombre">
                      <option value="">Seleccione tipo</option>
                      {tiposEquipo?.map((tipo) => (
                        <option key={tipo._id || tipo.id} value={tipo._id || tipo.id}>
                          {(tipo.tipoNombre || "").toUpperCase()}
                        </option>
                      ))}
                    </Field>
                  </label>
                  <ErrorMessage name="tipoNombre" component="div" className="form__group-error" />
                </div>

                <div className="form__group">
                  <label htmlFor="ip_gestion" className="form__group-label">
                    IP Gestión
                    <br />
                    <Field type="text" className="form__group-input" placeholder="IP gestión" name="ip_gestion" />
                  </label>
                  <ErrorMessage name="ip_gestion" component="div" className="form__group-error" />
                </div>
              </div>
            </div>

            <button type="submit" className="button btn-primary">
              Enviar
            </button>
          </Form>
        </ModalComponent>
      )}
    </Formik>
  );
};

export default ModalEquipment;
