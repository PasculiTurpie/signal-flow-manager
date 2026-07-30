import { Field, Form, Formik } from "formik";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../utils/api";
import styleNodo from "./Nodo.module.css";

const Nodo = () => {
    const [dataSignal, setDataSignal] = useState([]);

    const getAllSignal = () => {
        api.getSignal().then((res) => {
            setDataSignal(res.data);
        });
    };
    useEffect(() => {
        getAllSignal();
    }, []);
    
    return (
        <>
            <div className="outlet-main">
                <nav aria-label="breadcrumb">
                    <ol className="breadcrumb">
                        <li className="breadcrumb-item">
                            <Link to="/nodo-listar">Listar</Link>
                        </li>
                        <li
                            className="breadcrumb-item active"
                            aria-current="page"
                        >
                            Formulario
                        </li>
                    </ol>
                </nav>
                <Formik>
                    <Form>
                        <div className={styleNodo.container}>
                            <div className={styleNodo.input__group}>
                                <div className="form__group">
                                    <label
                                        htmlFor="signal"
                                        className="form__group-label"
                                    >
                                        Señal
                                    </label>
                                    <Field
                                        as="select"
                                        className="form__group-input"
                                        name="signal"
                                        id="signal"
                                    >
                                        <option>--Seleccionar--</option>
                                        {dataSignal?.map((signal) => (
                                            <option
                                                key={signal._id}
                                                value={signal._id}
                                            >
                                                {signal.nameChannel.toUpperCase()}
                                            </option>
                                        ))}
                                    </Field>
                                </div>
                            </div>
                            <div className={styleNodo.input__group}>
                                <div className="form__group">
                                    <label
                                        htmlFor="nodo"
                                        className="form__group-label"
                                    >
                                        Nodo
                                    </label>
                                    <Field
                                        as="select"
                                        className="form__group-input"
                                        name="nodo"
                                        id="nodo"
                                    >
                                        <option value="">
                                            --Seleccionar--
                                        </option>
                                    </Field>
                                </div>
                                <div className="form__group">
                                    <label
                                        htmlFor="nodo"
                                        className="form__group-label"
                                    >
                                        Nodo
                                    </label>
                                    <Field
                                        as="select"
                                        className="form__group-input"
                                        name="nodo"
                                        id="nodo"
                                    >
                                        <option value="">
                                            --Seleccionar--
                                        </option>
                                    </Field>
                                </div>
                            </div>
                        </div>
                        <button className="button btn-primary">
                            Crear nodo
                        </button>
                    </Form>
                </Formik>
            </div>
            
        </>
    );
};

export default Nodo;
