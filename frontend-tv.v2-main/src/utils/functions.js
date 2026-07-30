const handleTrimChange = (e, setFieldValue) => {
    const { name, value } = e.target;
    setFieldValue(name, value.trimStart()); // Evita espacios al inicio mientras escribe
};

export default handleTrimChange;