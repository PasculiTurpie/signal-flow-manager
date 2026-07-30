import "./Search.css";
import * as Yup from "yup";
import Swal from "sweetalert2";

import { Field, Form, Formik } from "formik";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const DEBOUNCE_MS = 350;

const SchemaSearch = Yup.object().shape({
  searchFilter: Yup.string().trim("No debe tener espacios al inicio o al final"),
});

const Search = () => {
  const [querySearch] = useSearchParams();
  const initialKeyword = (querySearch.get("keyword") ?? "").trim();

  const [term, setTerm] = useState(initialKeyword);
  const navigate = useNavigate();

  const debounceRef = useRef(null);

  // 🔄 Sincroniza el input si la URL cambia por navegación
  useEffect(() => {
    const kw = (querySearch.get("keyword") ?? "").trim();
    setTerm(kw);
  }, [querySearch]);

  // ⌛ Debounce: navega a /search?keyword= mientras se escribe
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Si está vacío, igualmente navegamos para que SearchFilter muestre “escribe para buscar”
    debounceRef.current = setTimeout(() => {
      const q = term.trim();
      if (q) {
        navigate(`/search?keyword=${encodeURIComponent(q)}`, { replace: false });
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [term, navigate]);

  return (
    <>
      <Formik
        enableReinitialize
        initialValues={{ searchFilter: term }}
        validationSchema={SchemaSearch}
        onSubmit={async (values, { resetForm }) => {
          try {
            const q = (values.searchFilter ?? "").trim();
            if (!q) {
              // Opcional: alerta si presionan Enter con vacío
              Swal.fire({
                icon: "info",
                title: "Búsqueda vacía",
                text: "Escribe algo para buscar.",
                timer: 1600,
                showConfirmButton: false,
              });
              return;
            }
            // ⚡ Navegación inmediata al presionar Enter
            navigate(`/search?keyword=${encodeURIComponent(q)}`);
            // No reseteo el form para mantener el término en el input
          } catch (error) {
            console.error(error);
          }
        }}
      >
        {({ setFieldValue }) => (
          <Form
            className="form__search"
            role="search"
            aria-label="Buscador global"
            onKeyDown={(e) => {
              // Enter se maneja por onSubmit, pero evitamos que alguna otra tecla envíe el form
              if (e.key === "Enter") {
                // Permitimos submit normal (Formik lo maneja)
              }
            }}
          >
            <Field name="searchFilter">
              {({ field }) => (
                <div className="search__group">
                  <input
                    {...field}
                    className="input__text-search"
                    type="search"
                    placeholder="Buscar canal, número, tecnología..."
                    value={term}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFieldValue("searchFilter", value);
                      setTerm(value);
                    }}
                    aria-label="Campo de búsqueda"
                    autoComplete="off"
                  />
                  {term && (
                    <button
                      type="button"
                      className="search__clear-btn"
                      aria-label="Limpiar búsqueda"
                      title="Limpiar"
                      onClick={() => {
                        setFieldValue("searchFilter", "");
                        setTerm("");
                      }}
                    >
                    </button>
                  )}
                </div>
              )}
            </Field>
          </Form>
        )}
      </Formik>
    </>
  );
};

export default Search;
