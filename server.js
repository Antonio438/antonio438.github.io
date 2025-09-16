const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { Pool } = require('pg'); // Importa o driver do PostgreSQL

const app = express();
const PORT = process.env.PORT || 8080; // Render usa a variável de ambiente PORT
const HOST = "0.0.0.0"; // Importante para o deploy no Render

// --- CONFIGURAÇÃO MANTIDA ---
const PLAN_DB_PATH = path.join(__dirname, 'plano.json'); // Mantido para o plano que parece ser estático
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage });

// --- NOVA CONFIGURAÇÃO DO BANCO DE DADOS ---
// A pool de conexões será configurada usando a URL que o Render.com fornece
// na variável de ambiente DATABASE_URL.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Necessário para conexões no Render
  }
});


app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOADS_DIR));


// --- ROTAS DA API AJUSTADAS ---

// Rota para o plano anual - Mantida lendo do arquivo, pois parece ser um dado inicial estático.
// Se o plano também precisar ser editável, ele precisará de sua própria tabela e rotas.
app.get('/api/plan', (req, res) => {
    try {
        if (fs.existsSync(PLAN_DB_PATH)) {
            const data = fs.readFileSync(PLAN_DB_PATH, 'utf-8');
            res.json(JSON.parse(data).processes || []);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error(`Erro ao ler o arquivo ${PLAN_DB_PATH}:`, error);
        res.status(500).json({ message: 'Erro ao carregar plano.' });
    }
});

// GET: Busca todos os processos do banco de dados
app.get('/api/processes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM processes ORDER BY isImportant DESC, id DESC');
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar processos:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});

// POST: Adiciona um novo processo no banco de dados
app.post('/api/processes', upload.array('files'), async (req, res) => {
    const newProcess = req.body;
    
    const initialDate = newProcess.startDate ? new Date(newProcess.startDate + 'T12:00:00Z').toISOString() : new Date().toISOString();
    const location = typeof newProcess.location === 'string' ? JSON.parse(newProcess.location) : newProcess.location;
    const attachments = req.files ? req.files.map(file => ({
        filename: file.filename,
        originalname: file.originalname,
        path: file.path
    })) : [];

    const history = [{ fase: newProcess.fase, startDate: initialDate, endDate: null }];
    const locationHistory = [{ ...location, startDate: initialDate, endDate: null }];

    try {
        const query = `
            INSERT INTO processes 
            (processNumber, object, value, deadline, priority, type, modality, fase, description, contractDate, purchasedValue, location, planId, attachments, creationDate, history, locationHistory, isImportant, alertInfo)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            RETURNING *;
        `;
        const values = [
            newProcess.processNumber || null, newProcess.object, parseFloat(newProcess.value), newProcess.deadline || null,
            newProcess.priority, newProcess.type, newProcess.modality, newProcess.fase,
            newProcess.description || null, newProcess.contractDate || null, newProcess.purchasedValue ? parseFloat(newProcess.purchasedValue) : null,
            JSON.stringify(location), newProcess.planId || null, JSON.stringify(attachments), initialDate,
            JSON.stringify(history), JSON.stringify(locationHistory), false, null
        ];

        const result = await pool.query(query, values);
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao criar processo:', error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});


// PUT: Atualiza um processo existente no banco de dados
app.put('/api/processes/:id', upload.array('files'), async (req, res) => {
    const processId = parseInt(req.params.id);
    const updatedData = req.body;

    try {
        const existingResult = await pool.query('SELECT * FROM processes WHERE id = $1', [processId]);
        if (existingResult.rows.length === 0) {
            return res.status(404).json({ message: 'Processo não encontrado.' });
        }
        const existingProcess = existingResult.rows[0];
        
        const now = new Date().toISOString();
        const shouldLogHistory = updatedData.logHistory !== 'false';
        
        let newHistory = existingProcess.history || [];
        let newLocationHistory = existingProcess.locationHistory || [];

        if (shouldLogHistory) {
            if (updatedData.fase && updatedData.fase !== existingProcess.fase) {
                const lastHistoryEntry = newHistory[newHistory.length - 1];
                if (lastHistoryEntry) lastHistoryEntry.endDate = now;
                
                let historyStartDate = now;
                if (updatedData.fase === 'Contratado' && updatedData.contractDate) {
                   historyStartDate = new Date(updatedData.contractDate + 'T12:00:00Z').toISOString();
                }
                newHistory.push({ fase: updatedData.fase, startDate: historyStartDate, endDate: null });
            }

            const newLocation = updatedData.location ? (typeof updatedData.location === 'string' ? JSON.parse(updatedData.location) : updatedData.location) : null;
            const currentLoc = existingProcess.location;
            if (newLocation && (newLocation.sector !== currentLoc.sector || newLocation.responsible !== currentLoc.responsible)) {
                const lastLocationEntry = newLocationHistory[newLocationHistory.length - 1];
                if (lastLocationEntry) lastLocationEntry.endDate = now;
                newLocationHistory.push({ ...newLocation, startDate: now, endDate: null });
            }
        }

        const newAttachments = req.files ? req.files.map(file => ({ filename: file.filename, originalname: file.originalname, path: file.path })) : [];
        const allAttachments = [...(existingProcess.attachments || []), ...newAttachments];

        const query = `
            UPDATE processes SET
                processNumber = $1, object = $2, value = $3, deadline = $4, priority = $5, type = $6, modality = $7, fase = $8,
                description = $9, contractDate = $10, purchasedValue = $11, location = $12, attachments = $13, history = $14,
                locationHistory = $15, isImportant = $16, alertInfo = $17, creationDate = $18
            WHERE id = $19
            RETURNING *;
        `;
        
        const location = updatedData.location ? (typeof updatedData.location === 'string' ? JSON.parse(updatedData.location) : updatedData.location) : existingProcess.location;
        const alertInfo = updatedData.alertInfo ? (typeof updatedData.alertInfo === 'string' ? JSON.parse(updatedData.alertInfo) : updatedData.alertInfo) : existingProcess.alertInfo;

        const values = [
            updatedData.processNumber !== undefined ? updatedData.processNumber : existingProcess.processNumber,
            updatedData.object !== undefined ? updatedData.object : existingProcess.object,
            updatedData.value !== undefined ? parseFloat(updatedData.value) : existingProcess.value,
            updatedData.deadline !== undefined ? updatedData.deadline : existingProcess.deadline,
            updatedData.priority !== undefined ? updatedData.priority : existingProcess.priority,
            updatedData.type !== undefined ? updatedData.type : existingProcess.type,
            updatedData.modality !== undefined ? updatedData.modality : existingProcess.modality,
            updatedData.fase !== undefined ? updatedData.fase : existingProcess.fase,
            updatedData.description !== undefined ? updatedData.description : existingProcess.description,
            updatedData.contractDate !== undefined ? updatedData.contractDate : existingProcess.contractDate,
            updatedData.purchasedValue !== undefined ? parseFloat(updatedData.purchasedValue) : existingProcess.purchasedValue,
            JSON.stringify(location),
            JSON.stringify(allAttachments),
            JSON.stringify(newHistory),
            JSON.stringify(newLocationHistory),
            updatedData.isImportant !== undefined ? updatedData.isImportant : existingProcess.isImportant,
            alertInfo === null ? null : (alertInfo !== undefined ? JSON.stringify(alertInfo) : existingProcess.alertInfo),
            updatedData.startDate ? new Date(updatedData.startDate + 'T12:00:00Z').toISOString() : existingProcess.creationdate,
            processId
        ];
        
        const result = await pool.query(query, values);
        res.json(result.rows[0]);
    } catch (error) {
        console.error(`Erro ao atualizar processo ${processId}:`, error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});


// DELETE: Remove um processo do banco de dados e seus arquivos
app.delete('/api/processes/:id', async (req, res) => {
    const processId = parseInt(req.params.id);
    try {
        // Primeiro, busca o processo para pegar a lista de arquivos
        const selectResult = await pool.query('SELECT attachments FROM processes WHERE id = $1', [processId]);
        
        if (selectResult.rows.length > 0) {
            const attachments = selectResult.rows[0].attachments || [];
            // Deleta os arquivos físicos do servidor
            attachments.forEach(file => {
                if (file.path && fs.existsSync(file.path)) {
                    try {
                        fs.unlinkSync(file.path);
                    } catch (err) {
                        console.error(`Erro ao deletar arquivo ${file.path}:`, err);
                    }
                }
            });
        }

        // Depois, deleta o registro do banco de dados
        const deleteResult = await pool.query('DELETE FROM processes WHERE id = $1', [processId]);
        if (deleteResult.rowCount === 0) {
            return res.status(404).json({ message: 'Processo não encontrado.' });
        }
        
        res.status(204).send();
    } catch (error) {
        console.error(`Erro ao deletar processo ${processId}:`, error);
        res.status(500).json({ message: 'Erro interno do servidor' });
    }
});


app.listen(PORT, HOST, () => {
    console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});
