const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 8080
const HOST = "192.168.19.250"

const PLAN_DB_PATH = path.join(__dirname, 'plano.json');
const PROCESSES_DB_PATH = path.join(__dirname, 'processos.json');
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

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOADS_DIR));

const readData = (filePath) => {
    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data);
        }
        return {}; 
    } catch (error) {
        console.error(`Erro ao ler o arquivo ${filePath}:`, error);
        return {};
    }
};

const writeData = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Erro ao escrever no arquivo ${filePath}:`, error);
    }
};

app.get('/api/plan', (req, res) => {
    const data = readData(PLAN_DB_PATH);
    res.json(data.processes || []);
});

app.get('/api/processes', (req, res) => {
    const data = readData(PROCESSES_DB_PATH);
    res.json(data.processes || []);
});

app.post('/api/processes', upload.array('files'), (req, res) => {
    const data = readData(PROCESSES_DB_PATH);
    if (!data.processes) data.processes = [];
    
    const newProcess = req.body;
    
    const initialDate = newProcess.startDate ? new Date(newProcess.startDate + 'T12:00:00Z').toISOString() : new Date().toISOString();

    newProcess.id = Date.now();
    newProcess.value = parseFloat(newProcess.value);
    
    if (typeof newProcess.location === 'string') {
        newProcess.location = JSON.parse(newProcess.location);
    }

    if (req.files) {
        newProcess.attachments = req.files.map(file => ({
            filename: file.filename,
            originalname: file.originalname,
            path: file.path
        }));
    } else {
        newProcess.attachments = [];
    }
    
    newProcess.creationDate = initialDate;

    newProcess.history = [{
        fase: newProcess.fase,
        startDate: initialDate,
        endDate: null
    }];

    newProcess.locationHistory = [{
        sector: newProcess.location.sector,
        responsible: newProcess.location.responsible,
        startDate: initialDate,
        endDate: null
    }];

    data.processes.push(newProcess);
    writeData(PROCESSES_DB_PATH, data);
    res.status(201).json(newProcess);
});

// ##### ROTA PUT MODIFICADA #####
app.put('/api/processes/:id', upload.array('files'), (req, res) => {
    const processId = parseInt(req.params.id);
    const updatedData = req.body;
    const data = readData(PROCESSES_DB_PATH);

    if (!data.processes) {
        return res.status(404).json({ message: 'Nenhum processo encontrado.' });
    }

    const processIndex = data.processes.findIndex(p => p.id === processId);

    if (processIndex === -1) {
        return res.status(404).json({ message: 'Processo não encontrado.' });
    }

    const existingProcess = { ...data.processes[processIndex] };
    const now = new Date().toISOString();
    
    // NOVO: Lógica para atualizar a data de início do processo
    if (updatedData.startDate) {
        const newStartDateISO = new Date(updatedData.startDate + 'T12:00:00Z').toISOString();
        
        // Atualiza a data de criação principal do processo
        existingProcess.creationDate = newStartDateISO;

        // Atualiza a data de início do PRIMEIRO registro do histórico de fases
        if (existingProcess.history && existingProcess.history.length > 0) {
            existingProcess.history[0].startDate = newStartDateISO;
        }

        // Atualiza a data de início do PRIMEIRO registro do histórico de localização
        if (existingProcess.locationHistory && existingProcess.locationHistory.length > 0) {
            existingProcess.locationHistory[0].startDate = newStartDateISO;
        }

        // Remove o campo para não ser processado novamente
        delete updatedData.startDate;
    }

    const shouldLogHistory = updatedData.logHistory !== 'false';

    if (shouldLogHistory) {
        if (updatedData.fase && updatedData.fase !== existingProcess.fase) {
            if (!existingProcess.history) existingProcess.history = [];
            
            const lastHistoryEntry = existingProcess.history[existingProcess.history.length - 1];
            if (lastHistoryEntry) {
                lastHistoryEntry.endDate = now;
            }

            let historyStartDate = now;
            if (updatedData.fase === 'Contratado' && updatedData.contractDate) {
                historyStartDate = new Date(updatedData.contractDate + 'T12:00:00Z').toISOString();
            }

            existingProcess.history.push({ 
                fase: updatedData.fase, 
                startDate: historyStartDate, 
                endDate: null 
            });
        }
        
        if (typeof updatedData.location === 'string') {
            updatedData.location = JSON.parse(updatedData.location);
        }

        const newLocation = updatedData.location;
        const currentLoc = existingProcess.location;
        if (newLocation && (newLocation.sector !== currentLoc.sector || newLocation.responsible !== currentLoc.responsible)) {
            if (!existingProcess.locationHistory) existingProcess.locationHistory = [];
            
            const lastLocationEntry = existingProcess.locationHistory[existingProcess.locationHistory.length - 1];
            if (lastLocationEntry) {
                lastLocationEntry.endDate = now;
            }

            existingProcess.locationHistory.push({
                sector: newLocation.sector,
                responsible: newLocation.responsible,
                startDate: now,
                endDate: null
            });
        }
    }

    const existingAttachments = existingProcess.attachments || [];
    const newAttachments = req.files ? req.files.map(file => ({
        filename: file.filename,
        originalname: file.originalname,
        path: file.path
    })) : [];
    
    if (updatedData.value) {
        updatedData.value = parseFloat(updatedData.value);
    }
    
    delete updatedData.logHistory;

    data.processes[processIndex] = { 
        ...existingProcess,
        ...updatedData, 
        id: processId,
        attachments: [...existingAttachments, ...newAttachments]
    };
    
    writeData(PROCESSES_DB_PATH, data);
    res.json(data.processes[processIndex]);
});


app.delete('/api/processes/:id', (req, res) => {
    const processId = parseInt(req.params.id);
    const data = readData(PROCESSES_DB_PATH);

    if (!data.processes) {
        return res.status(404).json({ message: 'Nenhum processo encontrado.' });
    }

    const processToDelete = data.processes.find(p => p.id === processId);
    
    if (processToDelete && processToDelete.attachments) {
        processToDelete.attachments.forEach(file => {
            if (fs.existsSync(file.path)) {
                fs.unlinkSync(file.path);
            }
        });
    }

    const initialLength = data.processes.length;
    data.processes = data.processes.filter(p => p.id !== processId);

    if (data.processes.length === initialLength) {
        return res.status(404).json({ message: 'Processo não encontrado.' });
    }

    writeData(PROCESSES_DB_PATH, data);
    res.status(204).send();
});

app.listen(PORT, HOST, () => {
    console.log(`Servidor rodando em http://${HOST}:${PORT}`);
});