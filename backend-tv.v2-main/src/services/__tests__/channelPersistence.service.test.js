const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Channel = require('../../models/channel.model');
const DiagramAudit = require('../../models/diagramAudit.model');
const {
  updateNodePosition,
  reconnectEdge,
  createEdge,
  updateEdgeTooltip,
} = require('../channelPersistence.service');

describe('Channel Persistence Service', () => {
  let mongoServer;
  let testChannelId;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Crear un channel de prueba
    const channel = await Channel.create({
      signal: new mongoose.Types.ObjectId(),
      nameChannel: 'Test Channel',
      nodes: [
        {
          id: 'node-1',
          type: 'imageNode',
          equipo: new mongoose.Types.ObjectId(),
          position: { x: 100, y: 200 },
          data: {
            label: 'Node 1',
            handles: [
              { id: 'out-right-1', type: 'source', side: 'right' },
              { id: 'in-left-1', type: 'target', side: 'left' },
            ],
          },
          handles: [
            { id: 'out-right-1', type: 'source', side: 'right' },
            { id: 'in-left-1', type: 'target', side: 'left' },
          ],
        },
        {
          id: 'node-2',
          type: 'imageNode',
          equipo: new mongoose.Types.ObjectId(),
          position: { x: 400, y: 200 },
          data: {
            label: 'Node 2',
            handles: [
              { id: 'out-right-1', type: 'source', side: 'right' },
              { id: 'in-left-1', type: 'target', side: 'left' },
            ],
          },
          handles: [
            { id: 'out-right-1', type: 'source', side: 'right' },
            { id: 'in-left-1', type: 'target', side: 'left' },
          ],
        },
      ],
      edges: [
        {
          id: 'edge-1',
          source: 'node-1',
          target: 'node-2',
          sourceHandle: 'out-right-1',
          targetHandle: 'in-left-1',
          type: 'smoothstep',
          data: {
            direction: 'ida',
            tooltip: 'Test edge',
            tooltipTitle: 'Test',
          },
        },
      ],
    });

    testChannelId = channel._id.toString();
  });

  afterEach(async () => {
    await Channel.deleteMany({});
    await DiagramAudit.deleteMany({});
  });

  describe('updateNodePosition', () => {
    it('debe actualizar la posición de un nodo exitosamente', async () => {
      const result = await updateNodePosition({
        channelId: testChannelId,
        nodeId: 'node-1',
        position: { x: 150, y: 250 },
        userId: null,
      });

      expect(result.ok).toBe(true);
      expect(result.node.id).toBe('node-1');
      expect(result.node.position.x).toBe(150);
      expect(result.node.position.y).toBe(250);
      expect(result.auditId).toBeDefined();

      // Verificar en la base de datos
      const channel = await Channel.findById(testChannelId);
      const node = channel.nodes.find((n) => n.id === 'node-1');
      expect(node.position.x).toBe(150);
      expect(node.position.y).toBe(250);

      // Verificar auditoría
      const audit = await DiagramAudit.findById(result.auditId);
      expect(audit.entityType).toBe('node');
      expect(audit.action).toBe('move');
      expect(audit.before.position).toEqual({ x: 100, y: 200 });
      expect(audit.after.position).toEqual({ x: 150, y: 250 });
    });

    it('debe fallar con channelId inválido', async () => {
      const result = await updateNodePosition({
        channelId: 'invalid-id',
        nodeId: 'node-1',
        position: { x: 150, y: 250 },
        userId: null,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toBe('Canal inválido');
    });

    it('debe fallar con nodo inexistente', async () => {
      const result = await updateNodePosition({
        channelId: testChannelId,
        nodeId: 'node-inexistente',
        position: { x: 150, y: 250 },
        userId: null,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(404);
      expect(result.message).toBe('Nodo no encontrado');
    });

    it('debe fallar con posición inválida', async () => {
      const result = await updateNodePosition({
        channelId: testChannelId,
        nodeId: 'node-1',
        position: { x: 'invalid', y: 250 },
        userId: null,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toBe('Posición inválida');
    });
  });

  describe('reconnectEdge', () => {
    it('debe reconectar un edge exitosamente', async () => {
      const result = await reconnectEdge({
        channelId: testChannelId,
        edgeId: 'edge-1',
        patch: {
          target: 'node-2',
          targetHandle: 'in-left-1',
        },
        userId: null,
      });

      expect(result.ok).toBe(true);
      expect(result.edge.id).toBe('edge-1');
      expect(result.edge.target).toBe('node-2');
      expect(result.edge.targetHandle).toBe('in-left-1');
      expect(result.auditId).toBeDefined();

      // Verificar auditoría
      const audit = await DiagramAudit.findById(result.auditId);
      expect(audit.entityType).toBe('edge');
      expect(audit.action).toBe('reconnect');
    });

    it('debe fallar con edge inexistente', async () => {
      const result = await reconnectEdge({
        channelId: testChannelId,
        edgeId: 'edge-inexistente',
        patch: {
          target: 'node-2',
        },
        userId: null,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(404);
      expect(result.message).toBe('Edge no encontrado');
    });

    it('debe fallar con nodo target inexistente', async () => {
      const result = await reconnectEdge({
        channelId: testChannelId,
        edgeId: 'edge-1',
        patch: {
          target: 'node-inexistente',
        },
        userId: null,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(404);
      expect(result.message).toContain('inexistente');
    });

    it('debe fallar con handle inválido', async () => {
      const result = await reconnectEdge({
        channelId: testChannelId,
        edgeId: 'edge-1',
        patch: {
          targetHandle: 'invalid-handle',
        },
        userId: null,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(409);
    });

    it('debe fallar sin cambios para aplicar', async () => {
      const result = await reconnectEdge({
        channelId: testChannelId,
        edgeId: 'edge-1',
        patch: {},
        userId: null,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toBe('Sin cambios para aplicar');
    });
  });

  describe('createEdge', () => {
    it('debe crear un nuevo edge exitosamente', async () => {
      const newEdge = {
        id: 'edge-2',
        source: 'node-2',
        target: 'node-1',
        sourceHandle: 'out-right-1',
        targetHandle: 'in-left-1',
        type: 'smoothstep',
        animated: true,
        data: {
          direction: 'vuelta',
          tooltip: 'New edge',
        },
      };

      const result = await createEdge({
        channelId: testChannelId,
        edge: newEdge,
        userId: null,
      });

      expect(result.ok).toBe(true);
      expect(result.edge.id).toBe('edge-2');
      expect(result.edge.source).toBe('node-2');
      expect(result.edge.target).toBe('node-1');
      expect(result.auditId).toBeDefined();

      // Verificar en la base de datos
      const channel = await Channel.findById(testChannelId);
      expect(channel.edges.length).toBe(2);
      const createdEdge = channel.edges.find((e) => e.id === 'edge-2');
      expect(createdEdge).toBeDefined();
      expect(createdEdge.source).toBe('node-2');
      expect(createdEdge.target).toBe('node-1');

      // Verificar auditoría
      const audit = await DiagramAudit.findById(result.auditId);
      expect(audit.entityType).toBe('edge');
      expect(audit.action).toBe('create');
      expect(audit.before).toBeNull();
      expect(audit.after.id).toBe('edge-2');
    });

    it('debe fallar con edge ID duplicado', async () => {
      const newEdge = {
        id: 'edge-1', // Ya existe
        source: 'node-2',
        target: 'node-1',
        sourceHandle: 'out-right-1',
        targetHandle: 'in-left-1',
      };

      const result = await createEdge({
        channelId: testChannelId,
        edge: newEdge,
        userId: null,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(409);
      expect(result.message).toBe('Ya existe un edge con ese ID');
    });

    it('debe fallar con nodo source inexistente', async () => {
      const newEdge = {
        id: 'edge-2',
        source: 'node-inexistente',
        target: 'node-1',
        sourceHandle: 'out-right-1',
        targetHandle: 'in-left-1',
      };

      const result = await createEdge({
        channelId: testChannelId,
        edge: newEdge,
        userId: null,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(404);
      expect(result.message).toContain('inexistente');
    });

    it('debe fallar con edge ID inválido', async () => {
      const newEdge = {
        id: '',
        source: 'node-1',
        target: 'node-2',
      };

      const result = await createEdge({
        channelId: testChannelId,
        edge: newEdge,
        userId: null,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toBe('Edge ID inválido');
    });

    it('debe fallar sin source o target', async () => {
      const newEdge = {
        id: 'edge-2',
        source: 'node-1',
        // Sin target
      };

      const result = await createEdge({
        channelId: testChannelId,
        edge: newEdge,
        userId: null,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(400);
      expect(result.message).toBe('Source y target son requeridos');
    });
  });

  describe('updateEdgeTooltip', () => {
    it('debe actualizar el tooltip de un edge exitosamente', async () => {
      const result = await updateEdgeTooltip({
        channelId: testChannelId,
        edgeId: 'edge-1',
        tooltipTitle: 'Nuevo título',
        tooltip: 'Nuevo contenido',
        userId: null,
      });

      expect(result.ok).toBe(true);
      expect(result.edge.id).toBe('edge-1');
      expect(result.edge.data.tooltipTitle).toBe('Nuevo título');
      expect(result.edge.data.tooltip).toBe('Nuevo contenido');
      expect(result.auditId).toBeDefined();

      // Verificar en la base de datos
      const channel = await Channel.findById(testChannelId);
      const edge = channel.edges.find((e) => e.id === 'edge-1');
      expect(edge.data.tooltipTitle).toBe('Nuevo título');
      expect(edge.data.tooltip).toBe('Nuevo contenido');

      // Verificar auditoría
      const audit = await DiagramAudit.findById(result.auditId);
      expect(audit.entityType).toBe('edge');
      expect(audit.action).toBe('edit');
      expect(audit.before.tooltipTitle).toBe('Test');
      expect(audit.after.tooltipTitle).toBe('Nuevo título');
    });

    it('debe fallar con edge inexistente', async () => {
      const result = await updateEdgeTooltip({
        channelId: testChannelId,
        edgeId: 'edge-inexistente',
        tooltipTitle: 'Nuevo título',
        userId: null,
      });

      expect(result.ok).toBe(false);
      expect(result.status).toBe(404);
      expect(result.message).toBe('Edge no encontrado');
    });
  });

  describe('Transacciones y consistencia', () => {
    it('debe hacer rollback en caso de error durante updateNodePosition', async () => {
      // Forzar un error al intentar actualizar un nodo con channelId inválido
      const originalPosition = { x: 100, y: 200 };

      const result = await updateNodePosition({
        channelId: 'invalid-id',
        nodeId: 'node-1',
        position: { x: 999, y: 999 },
        userId: null,
      });

      expect(result.ok).toBe(false);

      // Verificar que la posición no cambió
      const channel = await Channel.findById(testChannelId);
      const node = channel.nodes.find((n) => n.id === 'node-1');
      expect(node.position.x).toBe(originalPosition.x);
      expect(node.position.y).toBe(originalPosition.y);

      // Verificar que no se creó auditoría
      const audits = await DiagramAudit.find({ channelId: testChannelId });
      expect(audits.length).toBe(0);
    });

    it('debe mantener consistencia en reconexión de edges', async () => {
      const originalEdge = await Channel.findById(testChannelId).then((ch) =>
        ch.edges.find((e) => e.id === 'edge-1')
      );

      // Intentar reconectar a un nodo inexistente
      const result = await reconnectEdge({
        channelId: testChannelId,
        edgeId: 'edge-1',
        patch: { target: 'node-inexistente' },
        userId: null,
      });

      expect(result.ok).toBe(false);

      // Verificar que el edge no cambió
      const channel = await Channel.findById(testChannelId);
      const edge = channel.edges.find((e) => e.id === 'edge-1');
      expect(edge.source).toBe(originalEdge.source);
      expect(edge.target).toBe(originalEdge.target);
      expect(edge.sourceHandle).toBe(originalEdge.sourceHandle);
      expect(edge.targetHandle).toBe(originalEdge.targetHandle);
    });
  });
});
