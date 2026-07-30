const ipMulticastRegex =
    /^(2(?:[0-4]\d|5[0-5])\.(?:[0-9]{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(?:[0-9]{1,2}|1\d\d|2[0-4]\d|25[0-5])\.(?:[0-9]{1,2}|1\d\d|2[0-4]\d|25[0-5]))$/;

const ipGestionRegex = /^172\.(1[6-9]|2[0-9]|3[0-1])\.(25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})\.(25[0-5]|2[0-4][0-9]|1?[0-9]{1,2})$/;


const ipVideoMulticast = /^(192.168)?\.(\d{1,3}\.)\d{1,3}$/;

const emailValidate = /^[A-Z][a-z]+\.([A-Z][a-z]+)@grupogtd\.com$/;

const otherEmail= /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const urlRegex = /^(https?:\/\/)?([\w-]+\.)+[a-zA-Z]{2,}(:\d+)?(\/[^\s]*)?$/;

const phoneValidate = /^\+56\d{9}([-,\s]\+56\d{9})*$/;


export {
    ipMulticastRegex,
    ipGestionRegex,
    ipVideoMulticast,
    emailValidate,
    phoneValidate,
    otherEmail,
    urlRegex,
};
