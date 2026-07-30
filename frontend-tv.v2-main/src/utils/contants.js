const dataFlow = {
    nameChannel: "DREAMWORKS",
    numberChannelSur: "3",
    numberChannelCn: "3",
    logoChannel: "https://i.ibb.co/KX2gxHz/Dreamworks.jpg",
    severidadChannel: "4",
    tipoTecnologia: "Cobre",
    contacto: [
        {
            nombreContact: "Jorge Sepúlveda",
            email: "jsepulveda@gmail.com",
            telefono: "+56 9 88776655",
        },
    ],
    nodes: [
        {
            id: "1",
            type: "imageNode",
            position: { x: 350, y: 0 },
            data: {
                label: "IS-21",
                image: "https://i.ibb.co/23VpLD2N/satelite.jpg",
            },
        },
        {
            id: "2",
            type: "imageNode",
            position: { x: 150, y: 300 },
            data: {
                label: "IRD Cisco D9859",
                image: "https://i.ibb.co/fGM5NTcX/ird.jpg",
            },
        },
        {
            id: "3",
            type: "imageNode",
            position: { x: 750, y: 200 },
            data: {
                label: "Switch",
                image: "https://i.ibb.co/fGMRq8Fz/switch.jpg",
            },
        },
        {
            id: "4",
            type: "imageNode",
            position: { x: 550, y: 300 },
            data: {
                label: "Titan121",
                image: "https://i.ibb.co/wrJZLrqR/titan.jpg",
            },
        },
        {
            id: "5",
            type: "imageNode",
            position: { x: -50, y: 200 },
            data: {
                label: "RTES",
                image: "https://i.ibb.co/VcfxF9hz/rtes.jpg",
            },
        },
    ],
    edges: [
        {
            id: "e1-1",
            source: "1",
            target: "2",
            type: "draggableDirectional", // lineal | bezier | smoothstep | step
            animated: true,
            style: {
                stroke: "green",
                strokeWidth:2
            },
            data: {
                bandwidth: "10Gbps",
                protocolo: "UDP",
                label: "Enlace1",
                tooltipTitle: "Enlace creado",
                tooltip: "Gi1/0/23 to ETH1",
            },
            markerEnd: {
                type: "arrowclosed",
                color: "green",
            },
        },
        {
            id: "e1-2",
            source: "3",
            target: "1",
            sourceHandle: "out-right-1",
            targetHandle: "in-left-2",
            type: "draggableDirectional", // lineal | bezier | smoothstep | step
            animated: true,
            style: {
                stroke: "red",
            },
            data: {
                label:'enlace 2',
                bandwidth: "10Gbps",
                protocolo: "UDP",
                tooltipTitle: "Enlace creado",
                tooltip: "Gi1/0/23 to ETH1",
            },
            markerEnd: {
                type: "arrowclosed",
                color: "red",
            },
        },
        {
            id: "e1-3",
            source: "4",
            target: "1",
            sourceHandle: "out-top-1",
            targetHandle: "in-bottom-3",
            type: "draggableDirectional", // lineal | bezier | smoothstep | step
            animated: true,
            style: {
                stroke: "red",
            },
            data: {
                label:'enlace 3',
                bandwidth: "10Gbps",
                protocolo: "UDP",
                tooltipTitle: "Enlace creado",
                tooltip: "Gi1/0/23 to ETH1",
            },
            markerEnd: {
                type: "arrowclosed",
                color: "red",
            },
        },
        {
            id: "e1-4",
            source: "1",
            target: "5",
            sourceHandle: "out-right-3",
            targetHandle: "in-top-1",
            type: "draggableDirectional", // lineal | bezier | smoothstep | step
            animated: true,
            style: {
                stroke: "green",
            },
            data: {
                label:'enlace 4',
                bandwidth: "10Gbps",
                protocolo: "UDP",
                tooltipTitle: "Enlace creado",
                tooltip: "Gi1/0/23 to ETH1",
            },
            markerEnd: {
                type: "arrowclosed",
                color: "green",
            },
        },
        {
            id: "e1-5",
            source: "1",
            target: "3",
            sourceHandle: "out-bottom-4",
            targetHandle: "in-right-4",
            type: "draggableDirectional", // lineal | bezier | smoothstep | step
            animated: true,
            style: {
                stroke: "green",
            },
            data: {
                label: 'enlace 5',
                direction: "ida",
                tooltipTitle: "Enlace creado",
                tooltip: `Enlace MPLS`,
            },
            markerEnd: {
                type: "arrowclosed",
                color: "green",
            },
        },
    ],
};

export default dataFlow;
