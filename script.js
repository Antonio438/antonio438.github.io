document.addEventListener('DOMContentLoaded', () => {

    // CORRIGIDO: Apontar para os ficheiros JSON locais no seu repositório.
    const PLAN_API_URL = './database.json'; // Assumindo que este é o seu ficheiro do plano.
    const PROCESSES_API_URL = './processos.json';
    const UPLOADS_BASE_URL = './uploads'; // ATENÇÃO: Crie uma pasta 'uploads' e coloque os seus anexos nela.

    // =================================================================================
    // STATE & CONSTANTS
    // =================================================================================
    
    const PROCESS_PHASES = ["Não Iniciado", "Planejamento", "Em Licitação", "Contratado"];
    const PROCESS_SECTORS = ["Agente de Contratação", "Secretária/Presidente", "Comissão de Contratação", "Compras", "Equipe de Apoio", "Jurídico", "Outros"];
    const PROCESS_MODALITIES = ["A definir", "Pregão", "Dispensa", "Inexigibilidade", "Outros"];
    
    const CHART_COLORS = ['#5A67D8', '#9F7AEA', '#4FD1C5', '#F6AD55', '#E53E3E', '#68D391', '#4361ee'];

    let planData = [];
    let processesData = [];
    let chartInstances = {};
    let logoImage = null; 
    
    let isDashboardRedirect = false;
    let activeProcessFilter = null;
    let activePlanFilter = null;
    let currentEditingCell = null;
    let alertsToShow = [];
    
    const formatarValorBRL = (e) => {
        const input = e.target;
        let valor = input.value.replace(/\D/g, '');

        if (valor) {
            const numero = parseFloat(valor) / 100;
            input.value = numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        } else {
            input.value = '';
        }
    };

    const desformatarValorBRL = (valorFormatado) => {
        if (!valorFormatado) return "0.00";
        const apenasNumeros = valorFormatado.replace(/\D/g, '');
        if (apenasNumeros === "") return "0.00";
        const numero = parseFloat(apenasNumeros) / 100;
        return numero.toFixed(2);
    };


    // =================================================================================
    // API FUNCTIONS
    // =================================================================================
    const fetchPlan = async () => {
        try {
            // CORRIGIDO: A lógica de fetch agora lê o ficheiro JSON local.
            const response = await fetch(PLAN_API_URL);
            if (!response.ok) throw new Error('Erro ao buscar plano anual (database.json).');
            planData = await response.json();
            planData.forEach(item => {
                if (item.priority === 'Mídia') {
                    item.priority = 'Média';
                }
            });
        } catch (error) {
            console.error(error);
            showToast('Falha ao carregar o plano anual do ficheiro local.');
        }
    };

    const fetchProcesses = async () => {
        try {
            // CORRIGIDO: A lógica de fetch agora lê o ficheiro JSON local.
            const response = await fetch(PROCESSES_API_URL);
            if (!response.ok) throw new Error('Erro ao buscar processos (processos.json).');
            processesData = await response.json();
        } catch (error) {
            console.error(error);
            showToast('Falha ao carregar os processos do ficheiro local.');
        }
    };

    // CORRIGIDO: Funções de escrita agora mostram um alerta, pois não funcionam em modo estático.
    const addProcess = async (data) => {
        showToast('ERRO: Não é possível adicionar processos em modo de visualização.');
        console.error('Operação não permitida: A função de adicionar necessita de um servidor back-end.');
    };

    const updateProcess = async (id, data) => {
        showToast('ERRO: Não é possível atualizar processos em modo de visualização.');
        console.error('Operação não permitida: A função de atualizar necessita de um servidor back-end.');
    };

    const deleteProcess = async (id) => {
        showToast('ERRO: Não é possível excluir processos em modo de visualização.');
        console.error('Operação não permitida: A função de excluir necessita de um servidor back-end.');
    };

    const destroyChart = (chartId) => {
        if (chartInstances[chartId]) {
            chartInstances[chartId].destroy();
            delete chartInstances[chartId];
        }
    };
    
    // =================================================================================
    // RENDER FUNCTIONS
    // ... (O resto do seu código pode continuar exatamente como está, exceto por uma pequena correção) ...
    // =================================================================================
    
    // COLE TODO O SEU CÓDIGO RESTANTE A PARTIR DAQUI...
    // ... ATÉ ENCONTRAR A FUNÇÃO openProcessDetailModal ...

   function openProcessDetailModal(processId) {
        const process = processesData.find(p => p.id == processId);
        if (!process) return;
    
        const modal = document.getElementById('processDetailModal');
        modal.dataset.currentProcessId = processId; 
        const modalContent = modal.querySelector('.modal-content');
    
        modalContent.classList.remove('modal-xl');
        const icon = document.getElementById('btn-expand-modal').querySelector('i');
        icon.classList.remove('fa-compress-arrows-alt');
        icon.classList.add('fa-expand-arrows-alt');
    
        document.getElementById('detail-modal-title').textContent = `Processo Nº ${process.processNumber || 'N/A'}`;
        document.getElementById('detail-modal-object').textContent = process.object;
    
        const metricsBar = document.getElementById('detail-modal-metrics');
        metricsBar.innerHTML = '';
        let estimatedValue = process.value;
        if (process.planId) {
            const planItem = planData.find(item => parseInt(item.id, 10) === parseInt(process.planId, 10));
            if (planItem) estimatedValue = planItem.value;
        }
        const economy = (process.purchasedValue && estimatedValue) ? parseFloat(estimatedValue) - parseFloat(process.purchasedValue) : null;
    
        const metrics = [
            { label: 'Fase Atual', value: `<span class="process-status status-${process.fase.replace(/ /g, '-')}">${process.fase}</span>`, icon: 'fa-info-circle' },
            { label: 'Valor Estimado', value: parseFloat(estimatedValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), icon: 'fa-bullseye' },
            { label: 'Valor Final', value: process.purchasedValue ? parseFloat(process.purchasedValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A', icon: 'fa-check-double' },
            { label: 'Economia', value: economy !== null ? economy.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A', icon: 'fa-piggy-bank' },
            { label: 'Prazo Final', value: process.deadline ? new Date(process.deadline + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A', icon: 'fa-calendar-times' },
        ];
    
        metrics.forEach(metric => {
            const card = document.createElement('div');
            card.className = 'metric-card';
            card.innerHTML = `
                <span class="metric-card-label">${metric.label}</span>
                <span class="metric-card-value"><i class="fas ${metric.icon}"></i> ${metric.value}</span>
            `;
            metricsBar.appendChild(card);
        });
    
        const detailsContainer = document.getElementById('detail-tab-details');
        
        detailsContainer.innerHTML = '';

        if (process.alertInfo && process.alertInfo.alertDate) {
            const alertBox = document.createElement('div');
            alertBox.className = 'alert-info-box';
            const alertDate = new Date(process.alertInfo.alertDate + 'T00:00:00').toLocaleDateString('pt-BR');
    
            alertBox.innerHTML = `
                <div class="alert-info-header">
                    <i class="fas fa-bell"></i>
                    <h4>Alerta de Acompanhamento Ativo</h4>
                </div>
                <div class="alert-info-body">
                    <p><strong>Data do Alerta:</strong> ${alertDate}</p>
                    <p><strong>Anotação:</strong></p>
                    <pre class="alert-info-note">${process.alertInfo.note || 'Nenhuma anotação.'}</pre>
                </div>
            `;
            detailsContainer.appendChild(alertBox);
        }

        const detailsData = {
            'Prioridade': `<span class="card-priority priority-${process.priority}">${process.priority}</span>`,
            'Tipo': process.type,
            'Modalidade': process.modality || 'A definir',
            'Data de Contratação': process.contractDate ? new Date(process.contractDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A',
            'Setor Responsável': `${process.location.sector}`,
            'Responsável Direto': process.location.responsible || '-',
        };
        const detailsGridHTML = Object.entries(detailsData).map(([label, value]) => `
            <div class="info-item">
                <span class="info-label">${label}</span>
                <span class="info-value">${value}</span>
            </div>
        `).join('');
        detailsContainer.insertAdjacentHTML('beforeend', detailsGridHTML);

        const descriptionItem = document.createElement('div');
        descriptionItem.className = 'info-item full-span editable-description';
        descriptionItem.innerHTML = `
            <span class="info-label">Descrição</span>
            <span class="info-value">
                <textarea id="detail-description-textarea" class="form-control" rows="5" placeholder="Adicione uma descrição ou observações...">${process.description || ''}</textarea>
                <button class="btn btn-primary" id="detail-description-save-btn"><i class="fas fa-save"></i> Salvar Descrição</button>
            </span>
        `;
        detailsContainer.appendChild(descriptionItem);

        const historyContainer = document.getElementById('detail-tab-history');
        const phaseHistory = (process.history || []).map(entry => `
            <li class="timeline-item">
                <div class="timeline-icon"><i class="fas fa-flag"></i></div>
                <div class="timeline-content">
                    <p class="timeline-title">${entry.fase}</p>
                    <p class="timeline-meta">
                        ${
                            entry.fase === 'Contratado'
                            ? `Data: ${new Date(entry.startDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}`
                            : `Início: ${new Date(entry.startDate).toLocaleString('pt-BR')} | Duração: ${formatDuration(entry.startDate, entry.endDate)}`
                        }
                    </p>
                </div>
            </li>
        `).join('');
        const locationHistory = (process.locationHistory || []).map(entry => `
             <li class="timeline-item">
                <div class="timeline-icon"><i class="fas fa-map-marker-alt"></i></div>
                <div class="timeline-content">
                    <p class="timeline-title">${entry.sector} ${entry.responsible ? `(${entry.responsible})` : ''}</p>
                    <p class="timeline-meta">Início: ${new Date(entry.startDate).toLocaleString('pt-BR')} | Duração: ${formatDuration(entry.startDate, entry.endDate)}</p>
                </div>
            </li>
        `).join('');
        historyContainer.innerHTML = `<div class="history-container">
            <div><h4>Histórico de Fases</h4><ul class="timeline">${phaseHistory || '<li>Nenhum histórico de fase.</li>'}</ul></div>
            <div><h4>Histórico de Localizações</h4><ul class="timeline">${locationHistory || '<li>Nenhum histórico de localização.</li>'}</ul></div>
        </div>`;
    
        const attachmentsListContainer = document.querySelector('#processDetailModal .attachments-list-container');
        const attachmentsPreviewContainer = document.querySelector('#processDetailModal .attachments-preview-container');
        attachmentsListContainer.innerHTML = '';
        attachmentsPreviewContainer.innerHTML = '<div class="preview-placeholder"><i class="fas fa-file-alt"></i><p>Selecione um arquivo para visualizar</p></div>';
        
        if (process.attachments && process.attachments.length > 0) {
            const ul = document.createElement('ul');
            ul.className = 'attachments-list';
            process.attachments.forEach(file => {
                const li = document.createElement('li');
                // CORRIGIDO: Apontar para a pasta local 'uploads'
                const fileUrl = `${UPLOADS_BASE_URL}/${file.filename}`;
                const fileExtension = file.originalname.split('.').pop();
                li.innerHTML = `
                    <div class="attachment-info">
                        <i class="fas fa-file"></i>
                        <span class="attachment-name">${file.originalname}</span>
                    </div>
                    <div class="action-buttons-group">
                        <button class="btn-action-icon view-file-btn" data-url="${fileUrl}" data-type="${fileExtension}" data-name="${file.originalname}" data-tooltip="Visualizar"><i class="fas fa-eye"></i></button>
                        <a href="${fileUrl}" download="${file.originalname}" class="btn-action-icon" data-tooltip="Download"><i class="fas fa-download"></i></a>
                    </div>`;
                ul.appendChild(li);
            });
            attachmentsListContainer.appendChild(ul);
        } else {
            attachmentsListContainer.innerHTML = '<p class="no-attachments">Nenhum anexo encontrado.</p>';
        }
    
        const detailFileInput = document.getElementById('detail-modal-file-input');
        const detailFileList = document.getElementById('detail-modal-file-list');
        const detailUploadBtn = document.getElementById('detail-modal-upload-btn');
        if (detailFileInput) detailFileInput.value = '';
        if (detailFileList) detailFileList.innerHTML = '';
        if (detailUploadBtn) detailUploadBtn.style.display = 'none';
    
        modal.classList.add('active');
        setupModalTabs(modal);
    }

    // COLE TODO O RESTO DO SEU CÓDIGO AQUI, SEM MAIS ALTERAÇÕES.
    // ...
                          }
    function openAttachmentViewer(url, type, name) {
        const modal = document.getElementById('attachmentViewerModal');
        const title = document.getElementById('attachment-viewer-title');
        const contentArea = document.getElementById('attachment-viewer-content');

        title.textContent = name;
        contentArea.innerHTML = ''; 

        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type)) {
            contentArea.innerHTML = `<img src="${url}" alt="Visualização do anexo">`;
        } else if (type === 'pdf') {
            contentArea.innerHTML = `<iframe src="${url}" frameborder="0"></iframe>`;
        } else {
            contentArea.innerHTML = `<div class="preview-placeholder">
                <i class="fas fa-file-excel"></i>
                <p>Visualização não disponível para arquivos <strong>.${type}</strong>.</p>
                <a href="${url}" target="_blank" class="btn btn-secondary">Abrir em nova aba</a>
            </div>`;
        }
        
        modal.classList.add('active');
    }

    
    function setupModalTabs(modal) {
        const tabs = modal.querySelectorAll('.detail-tab-btn');
        const contents = modal.querySelectorAll('.detail-tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const targetTab = tab.dataset.tab;
                contents.forEach(content => {
                    content.classList.toggle('active', content.dataset.tab === targetTab);
                });
            });
        });

        if (tabs.length > 0) {
            tabs[0].click();
        }
    }

    function showToast(message) {
        const toastContainer = document.querySelector('.toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast'; toast.textContent = message;
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    // --- Event Listeners ---
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('main-content');
        const icon = document.getElementById('sidebar-toggle').querySelector('i');

        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('sidebar-collapsed');

        if (sidebar.classList.contains('collapsed')) {
            icon.classList.remove('fa-chevron-left');
            icon.classList.add('fa-chevron-right');
        } else {
            icon.classList.remove('fa-chevron-right');
            icon.classList.add('fa-chevron-left');
        }
    });

    document.getElementById('theme-toggle').addEventListener('change', (e) => {
        document.body.classList.toggle('theme-light', !e.target.checked);
        document.body.classList.toggle('theme-dark', e.target.checked);
    });
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelector('.nav-item.active')?.classList.remove('active');
            item.classList.add('active');
            document.querySelector('.content-section.active')?.classList.remove('active');
            const newSectionId = item.dataset.section;
            document.getElementById(newSectionId).classList.add('active');

            if (!isDashboardRedirect) {
                activeProcessFilter = null;
                activePlanFilter = null;
                document.getElementById('filter-status').value = '';
                document.getElementById('filter-type').value = '';
                document.getElementById('filter-search-process').value = '';
                document.getElementById('filter-search-plan').value = '';
                // Quando a navegação é manual, a tabela do plano deve mostrar todos os itens.
                if (newSectionId === 'contract-plan') {
                    populateContractPlanTable(planData);
                }
            }


            if (newSectionId === 'processes') {
                populateProcessesTable();
            }

            isDashboardRedirect = false;
        });
    });

    const dashboardTabsContainer = document.querySelector('#dashboards .dashboard-nav-tabs');
    if (dashboardTabsContainer) {
        dashboardTabsContainer.addEventListener('click', (e) => {
            if (e.target.matches('.dashboard-tab-btn')) {
                const tabId = e.target.dataset.tabId;
                dashboardTabsContainer.querySelector('.dashboard-tab-btn.active').classList.remove('active');
                e.target.classList.add('active');
                const contentContainer = document.querySelector('.dashboard-content-container');
                contentContainer.querySelector('.dashboard-tab-content.active').classList.remove('active');
                contentContainer.querySelector(`.dashboard-tab-content[data-tab-id="${tabId}"]`).classList.add('active');
            }
        });
    }

    const reportTabsContainer = document.getElementById('report-tabs-nav');
    if (reportTabsContainer) {
        reportTabsContainer.addEventListener('click', (e) => {
            const button = e.target.closest('.dashboard-tab-btn');
            if (button) {
                const tabId = button.dataset.tabId;
                reportTabsContainer.querySelector('.dashboard-tab-btn.active').classList.remove('active');
                button.classList.add('active');
                
                document.querySelectorAll('.report-tab-content').forEach(content => {
                    content.classList.toggle('active', content.dataset.tabId === tabId);
                });
                document.getElementById('report-view-area').classList.add('hidden-field');
            }
        });
    }

    document.getElementById('dashboards').addEventListener('click', (e) => {
        const card = e.target.closest('.stat-card.clickable');
        if (!card) return;
    
        isDashboardRedirect = true;
        const navLinkProcesses = document.querySelector('.nav-item[data-section="processes"]');
        const navLinkPlan = document.querySelector('.nav-item[data-section="contract-plan"]');
    
        const processStatusFilter = card.dataset.filterStatus;
        const processSpecialFilter = card.dataset.filterProcess;
        const planFilter = card.dataset.filterPlan;
    
        if (processStatusFilter && navLinkProcesses) {
            activeProcessFilter = null;
            document.getElementById('filter-status').value = processStatusFilter;
            navLinkProcesses.click();
        } else if (processSpecialFilter && navLinkProcesses) {
            document.getElementById('filter-status').value = '';
            activeProcessFilter = processSpecialFilter;
            navLinkProcesses.click();
        } else if (planFilter && navLinkPlan) {
            activePlanFilter = planFilter;
            navLinkPlan.click();
    
            const initiatedPlanIds = new Set(processesData.map(p => parseInt(p.planId, 10)).filter(id => !isNaN(id)));
            const contractedPlanIds = new Set(
                processesData
                    .filter(p => p.planId && p.fase === 'Contratado')
                    .map(p => parseInt(p.planId, 10))
                    .filter(id => !isNaN(id))
            );
    
            const today = new Date();
            today.setHours(0, 0, 0, 0);
    
            if (activePlanFilter === 'upcoming') {
                const thirtyDaysFromNow = new Date(new Date().setDate(today.getDate() + 30));
                
                const upcomingItemsData = planData.filter(item => {
                    if (!item.deadline) return false;
                    const deadline = new Date(item.deadline + 'T00:00:00');
                    const isWithinWindow = deadline <= thirtyDaysFromNow && deadline >= today;
                    const isNotInitiated = !initiatedPlanIds.has(parseInt(item.id, 10));
                    return isWithinWindow && isNotInitiated;
                });
                populateContractPlanTable(upcomingItemsData);
    
            } else if (activePlanFilter === 'overdue') {
                const overdueItemsData = planData.filter(item => {
                    if (!item.deadline) return false;
                    const deadline = new Date(item.deadline + 'T00:00:00');
                    const isOverdue = deadline < today;
                    const isNotContracted = !contractedPlanIds.has(parseInt(item.id, 10));
                    return isOverdue && isNotContracted;
                });
                populateContractPlanTable(overdueItemsData);
            }
        }
    });

    document.getElementById('add-process-btn').addEventListener('click', () => openProcessModal());
    document.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.modal').classList.remove('active'));
    });

    document.getElementById('process-status').addEventListener('change', (e) => {
        toggleContractFields(e.target.value);
    });

    document.getElementById('processForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('process-id').value;
        const formData = new FormData();
        
        formData.append('processNumber', document.getElementById('process-number').value);
        formData.append('object', document.getElementById('process-object').value);
        formData.append('value', desformatarValorBRL(document.getElementById('process-value').value));
        formData.append('deadline', document.getElementById('process-deadline').value);
        formData.append('priority', document.getElementById('process-priority').value);
        formData.append('type', document.getElementById('process-type').value);
        formData.append('modality', document.getElementById('process-modality').value);
        formData.append('fase', document.getElementById('process-status').value);
        formData.append('description', document.getElementById('process-description').value);
        formData.append('contractDate', document.getElementById('process-contractDate').value);
        formData.append('purchasedValue', desformatarValorBRL(document.getElementById('process-purchasedValue').value));
        
        const startDateInput = document.getElementById('process-startDate');
        formData.append('startDate', startDateInput.value);
        
        const location = {
            sector: document.getElementById('process-sector').value,
            responsible: document.getElementById('process-responsible').value,
        };
        formData.append('location', JSON.stringify(location));

        const planIdInput = document.getElementById('process-plan-id');
        if (planIdInput && planIdInput.value) {
            formData.append('planId', planIdInput.value);
        }

        const files = document.getElementById('process-files').files;
        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }

        if (id) {
            const logHistory = document.getElementById('log-history-checkbox').checked;
            formData.append('logHistory', logHistory);
            await updateProcess(id, formData);
        } else {
            await addProcess(formData);
        }
        
        showToast('Dados salvos com sucesso!');
        document.getElementById('processModal').classList.remove('active');
        await initializeApp();
    });

    document.querySelectorAll('#filter-status, #filter-type, #filter-search-process').forEach(filter => filter.addEventListener('input', () => {
        activeProcessFilter = null;
        populateProcessesTable();
        checkFilterActivity();
    }));

    document.getElementById('filter-search-plan').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredData = planData.filter(p =>
            String(p.id).includes(searchTerm) ||
            p.object.toLowerCase().includes(searchTerm)
        );
        populateContractPlanTable(filteredData);
        checkFilterActivity();
    });
    
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            
            const collapsibleContainer = header.closest('.collapsible-filters');
            if (collapsibleContainer) {
                collapsibleContainer.classList.toggle('collapsed');
            }
        });
    });

    document.querySelectorAll('#filter-analytics-month, #filter-analytics-type, #filter-analytics-modality').forEach(filter => {
        filter.addEventListener('input', () => {
            renderAnalyticsDashboard();
            checkFilterActivity();
        });
    });

    document.getElementById('processes-table').addEventListener('click', async (e) => {
        const alterBtn = e.target.closest('.btn-alterar');
        if (alterBtn) {
            openProcessModal(alterBtn.dataset.id);
            return;
        }
    
        const deleteBtn = e.target.closest('.btn-excluir');
        if (deleteBtn) {
            const processId = deleteBtn.dataset.id;
            const process = processesData.find(p => p.id == processId);
            if (confirm(`Tem certeza que deseja excluir o processo "${process.processNumber}: ${process.object}"?`)) {
                await deleteProcess(processId);
                await initializeApp();
            }
            return;
        }
        
        const detailTrigger = e.target.closest('.process-number-clickable, .process-object-clickable');
        if(detailTrigger) {
            openProcessDetailModal(detailTrigger.dataset.id);
            return;
        }
        
        const importantBtn = e.target.closest('.btn-importante');
        if (importantBtn) {
            const processId = importantBtn.dataset.id;
            const process = processesData.find(p => p.id == processId);
            const newStatus = !(process.isImportant || false);

            await updateProcess(processId, { isImportant: newStatus });
            await initializeApp();

            if (newStatus) {
                showToast("Processo marcado como importante.");
                openConfirmAlertModal(processId);
            } else {
                showToast("Processo desmarcado como importante.");
            }
            return;
        }
    });

    document.getElementById('process-files').addEventListener('change', (e) => {
        const fileListDisplay = document.getElementById('file-list-display');
        fileListDisplay.innerHTML = '';
        if (e.target.files.length > 0) {
            for (const file of e.target.files) {
                const fileItem = document.createElement('span');
                fileItem.textContent = file.name;
                fileListDisplay.appendChild(fileItem);
            }
        }
    });

    document.getElementById('processDetailModal').addEventListener('click', async (e) => {
        if (e.target.closest('#detail-description-save-btn')) {
            const modal = e.currentTarget;
            const processId = modal.dataset.currentProcessId;
            const newDescription = document.getElementById('detail-description-textarea').value;
    
            if (processId) {
                await updateProcess(processId, { description: newDescription });
                showToast('Descrição atualizada com sucesso!');
                document.getElementById('detail-description-save-btn').style.display = 'none';
                const p = processesData.find(proc => proc.id == processId);
                if (p) p.description = newDescription;
            }
        }
    
        const expandButton = e.target.closest('#btn-expand-modal');
        if (expandButton) {
            const modalContent = document.querySelector('#processDetailModal .modal-content');
            modalContent.classList.toggle('modal-xl');
            const icon = expandButton.querySelector('i');
            if (modalContent.classList.contains('modal-xl')) {
                icon.classList.remove('fa-expand-arrows-alt');
                icon.classList.add('fa-compress-arrows-alt');
            } else {
                icon.classList.remove('fa-compress-arrows-alt');
                icon.classList.add('fa-expand-arrows-alt');
            }
        }
    
        const viewBtn = e.target.closest('.view-file-btn');
        if (viewBtn) {
            const url = viewBtn.dataset.url;
            const type = viewBtn.dataset.type.toLowerCase();
            const name = viewBtn.dataset.name;
            const previewArea = document.querySelector('#processDetailModal .attachments-preview-container');
    
            document.querySelectorAll('#processDetailModal .attachments-list li').forEach(item => item.classList.remove('active'));
            viewBtn.closest('li').classList.add('active');
            
            let previewHTML = '';
            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type)) {
                previewHTML = `<img src="${url}" alt="Preview" class="preview-content">`;
            } else if (type === 'pdf') {
                previewHTML = `<iframe src="${url}" class="preview-content" frameborder="0"></iframe>`;
            } else {
                previewHTML = `<div class="preview-placeholder">
                    <i class="fas fa-file-excel"></i>
                    <p>Pré-visualização não disponível para arquivos <strong>.${type}</strong>.</p>
                    <a href="${url}" target="_blank" class="btn btn-secondary">Abrir em nova aba</a>
                </div>`;
            }
    
            previewArea.innerHTML = previewHTML;
    
            const expandAttachmentBtn = document.createElement('button');
            expandAttachmentBtn.className = 'btn-expand-preview';
            expandAttachmentBtn.innerHTML = '<i class="fas fa-expand"></i>';
            expandAttachmentBtn.dataset.url = url;
            expandAttachmentBtn.dataset.type = type;
            expandAttachmentBtn.dataset.name = name;
            previewArea.appendChild(expandAttachmentBtn);
        }
    
        const expandAttachmentBtn = e.target.closest('.btn-expand-preview');
        if (expandAttachmentBtn) {
            openAttachmentViewer(
                expandAttachmentBtn.dataset.url,
                expandAttachmentBtn.dataset.type,
                expandAttachmentBtn.dataset.name
            );
        }
    });

    document.getElementById('processDetailModal').addEventListener('input', (e) => {
        if (e.target.id === 'detail-description-textarea') {
            document.getElementById('detail-description-save-btn').style.display = 'inline-flex';
        }
    });

    document.getElementById('detail-modal-file-input').addEventListener('change', (e) => {
        const fileListDisplay = document.getElementById('detail-modal-file-list');
        const uploadBtn = document.getElementById('detail-modal-upload-btn');
        fileListDisplay.innerHTML = '';
        if (e.target.files.length > 0) {
            for (const file of e.target.files) {
                const fileItem = document.createElement('span');
                fileItem.textContent = file.name;
                fileListDisplay.appendChild(fileItem);
            }
            uploadBtn.style.display = 'inline-flex';
        } else {
            uploadBtn.style.display = 'none';
        }
    });

    document.getElementById('detail-modal-upload-btn').addEventListener('click', async () => {
        const modal = document.getElementById('processDetailModal');
        const processId = modal.dataset.currentProcessId;
        const files = document.getElementById('detail-modal-file-input').files;
    
        if (processId && files.length > 0) {
            const formData = new FormData();
            for (let i = 0; i < files.length; i++) {
                formData.append('files', files[i]);
            }
            
            await updateProcess(processId, formData);
            showToast('Arquivos enviados com sucesso!');
            
            await fetchProcesses();
            openProcessDetailModal(processId);
        }
    });

    document.getElementById('attachment-viewer-print-btn').addEventListener('click', () => {
        const contentArea = document.getElementById('attachment-viewer-content');
        const content = contentArea.firstChild;

        if (!content) {
            showToast('Nenhum conteúdo para imprimir.');
            return;
        }

        if (content.tagName === 'IFRAME') {
            try {
                content.contentWindow.focus();
                content.contentWindow.print();
            } catch (error) {
                showToast('Não foi possível imprimir o PDF. Tente abri-lo em uma nova aba.');
                console.error("Erro ao imprimir o Iframe:", error);
            }
        } else if (content.tagName === 'IMG') {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                    <head><title>Imprimir Anexo</title></head>
                    <body style="margin:0; text-align: center;" onload="window.print(); window.close()">
                        <img src="${content.src}" style="max-width: 100%; max-height: 100vh;">
                    </body>
                </html>
            `);
            printWindow.document.close();
        }
    });

    // =================================================================================
    // ALERT & IMPORTANCE LOGIC
    // =================================================================================

    function openConfirmAlertModal(processId) {
        const modal = document.getElementById('confirmAlertModal');
        document.getElementById('confirm-alert-process-id').value = processId;
        modal.classList.add('active');
    }

    document.getElementById('confirm-create-alert-btn').addEventListener('click', () => {
        const processId = document.getElementById('confirm-alert-process-id').value;
        document.getElementById('confirmAlertModal').classList.remove('active');
        openMarkImportantModal(processId);
    });

    document.getElementById('cancel-create-alert-btn').addEventListener('click', () => {
        document.getElementById('confirmAlertModal').classList.remove('active');
    });

    function openMarkImportantModal(processId) {
        const modal = document.getElementById('markImportantModal');
        const form = document.getElementById('markImportantForm');
        form.reset();
        document.getElementById('important-process-id').value = processId;
        const dateInput = document.getElementById('alert-date-input');
        dateInput.min = new Date().toISOString().split("T")[0];
        dateInput.value = new Date().toISOString().split("T")[0];
        modal.classList.add('active');
    }

    document.getElementById('markImportantForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const processId = document.getElementById('important-process-id').value;
        const alertInfo = {
            note: document.getElementById('alert-note-input').value,
            alertDate: document.getElementById('alert-date-input').value,
        };
        await updateProcess(processId, { alertInfo });
        showToast("Alerta criado com sucesso!");
        document.getElementById('markImportantModal').classList.remove('active');
        await initializeApp();
    });

    function checkAlerts() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        alertsToShow = [];

        processesData.forEach(p => {
            if (p.alertInfo && p.alertInfo.alertDate) {
                const alertDate = new Date(p.alertInfo.alertDate + 'T00:00:00'); 
                if (alertDate <= today) {
                    alertsToShow.push(p);
                }
            }
        });
        showNextAlert();
    }

    function showNextAlert() {
        if (alertsToShow.length > 0) {
            const process = alertsToShow.shift();
            showAlert(process);
        }
    }

    function showAlert(process) {
        const modal = document.getElementById('viewAlertModal');
        document.getElementById('alert-process-info').textContent = `Processo Nº ${process.processNumber || 'N/A'}: ${process.object}`;
        document.getElementById('alert-note').textContent = process.alertInfo.note;
        
        const okBtn = document.getElementById('ok-alert-btn');
        const deactivateBtn = document.getElementById('deactivate-alert-btn');

        const cleanAlertHandlers = () => {
             okBtn.replaceWith(okBtn.cloneNode(true));
             deactivateBtn.replaceWith(deactivateBtn.cloneNode(true));
        };

        const okHandler = () => {
            modal.classList.remove('active');
            cleanAlertHandlers();
            showNextAlert();
        };

        const deactivateHandler = async () => {
            await updateProcess(process.id, { alertInfo: null, isImportant: false }); // Desmarca como importante também
            modal.classList.remove('active');
            cleanAlertHandlers();
            await initializeApp();
            showNextAlert();
        };
        
        okBtn.addEventListener('click', okHandler, { once: true });
        deactivateBtn.addEventListener('click', deactivateHandler, { once: true });

        modal.classList.add('active');
    }

    // =================================================================================
    // IN-CELL EDITING LOGIC
    // =================================================================================
    const popover = document.getElementById('cell-editor-popover');
    const popoverContent = document.getElementById('cell-editor-content');
    const popoverCancel = document.getElementById('cell-editor-cancel');
    const popoverSave = document.getElementById('cell-editor-save');

    const closeEditor = () => {
        if (currentEditingCell) {
            currentEditingCell.classList.remove('editing-cell');
            currentEditingCell = null;
        }
        popover.style.display = 'none';
    };

    const openEditor = (cell) => {
        closeEditor(); 
        currentEditingCell = cell;
        cell.classList.add('editing-cell');
        popoverContent.innerHTML = '';

        const id = parseInt(cell.dataset.id);
        const field = cell.dataset.field;
        
        const process = processesData.find(p => p.id === id);
        if (!process && field !== 'status') return;

        if (field === 'fase' || field === 'location' || field === 'modality') {
            if (field === 'fase' || field === 'modality') {
                const options = field === 'fase' ? PROCESS_PHASES : PROCESS_MODALITIES;
                const currentValue = field === 'fase' ? process.fase : process.modality;
                const select = document.createElement('select');
                select.className = 'table-editor-select';
                select.id = `editor-${field}`;
                options.forEach(opt => {
                    const option = document.createElement('option');
                    option.value = opt;
                    option.textContent = opt;
                    if (opt === currentValue) option.selected = true;
                    select.appendChild(option);
                });
                popoverContent.appendChild(select);
            } else if (field === 'location') {
                const select = document.createElement('select');
                select.className = 'table-editor-select';
                select.id = 'editor-sector';
                PROCESS_SECTORS.forEach(sector => {
                    const option = document.createElement('option');
                    option.value = sector;
                    option.textContent = sector;
                    if (sector === process.location.sector) option.selected = true;
                    select.appendChild(option);
                });
                const input = document.createElement('input');
                input.type = 'text';
                input.id = 'editor-responsible';
                input.className = 'table-editor-input';
                input.value = process.location.responsible || '';
                input.placeholder = 'Responsável';
                popoverContent.append(select, input);
            }
        } else if (field === 'status') {
            const processForPlan = processesData.find(p => p.planId == id);
            const currentStatus = processForPlan ? processForPlan.fase : 'Não Iniciado';
            
            const select = document.createElement('select');
            select.className = 'table-editor-select';
            select.id = 'editor-plan-status';
            PROCESS_PHASES.forEach(phase => {
                const option = document.createElement('option');
                option.value = phase;
                option.textContent = phase;
                if (phase === currentStatus) option.selected = true;
                select.appendChild(option);
            });
            popoverContent.appendChild(select);
        }

        const cellRect = cell.getBoundingClientRect();
        popover.style.left = `${cellRect.left + window.scrollX}px`;
        popover.style.top = `${cellRect.bottom + window.scrollY}px`;
        popover.style.display = 'block';
    };

    popoverSave.addEventListener('click', async () => {
        if (!currentEditingCell) return;
    
        const id = parseInt(currentEditingCell.dataset.id);
        const field = currentEditingCell.dataset.field;
    
        const refreshProcessDataAndUI = async () => {
            await fetchProcesses();
            renderApp();
        };
    
        if (field === 'fase') {
            const newStatus = popoverContent.querySelector('#editor-fase').value;
            if (newStatus === 'Contratado') {
                openContractDetailsModal(id);
            } else {
                await updateProcess(id, { fase: newStatus });
                showToast("Fase atualizada!");
                await refreshProcessDataAndUI();
            }
        } else if (field === 'location') {
            const updatedData = {
                location: {
                    sector: popoverContent.querySelector('#editor-sector').value,
                    responsible: popoverContent.querySelector('#editor-responsible').value
                }
            };
            await updateProcess(id, updatedData);
            showToast("Localização atualizada!");
            await refreshProcessDataAndUI();
        } else if (field === 'modality') {
            const newModality = popoverContent.querySelector('#editor-modality').value;
            await updateProcess(id, { modality: newModality });
            
            const processIndex = processesData.findIndex(p => p.id === id);
            if (processIndex !== -1) {
                processesData[processIndex].modality = newModality;
            }
            populateProcessesTable();
            showToast("Modalidade atualizada!");
    
        } else if (field === 'status') {
            const planId = id;
            const processToUpdate = processesData.find(p => p.planId == planId);
            const newStatus = popoverContent.querySelector('#editor-plan-status').value;
    
            if (newStatus === 'Não Iniciado') {
                if (processToUpdate) {
                    await deleteProcess(processToUpdate.id);
                    await initializeApp();
                }
            } else {
                if (processToUpdate) {
                    await updateProcess(processToUpdate.id, { fase: newStatus });
                    showToast("Status atualizado!");
                    await initializeApp();
                } else {
                    const planItem = planData.find(item => item.id == planId);
                    if (planItem) {
                        openProcessModal(null, planItem);
                    }
                }
            }
        }
    
        closeEditor();
    });

    document.getElementById('contractDetailsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const processId = document.getElementById('contract-details-process-id').value;
        const purchasedValue = desformatarValorBRL(document.getElementById('contract-purchasedValue').value);
        const contractDate = document.getElementById('contract-contractDate').value;
        
        const updatedData = {
            fase: 'Contratado',
            purchasedValue,
            contractDate
        };
        
        await updateProcess(processId, updatedData);
        showToast("Processo atualizado para Contratado!");
        document.getElementById('contractDetailsModal').classList.remove('active');
        await initializeApp();
    });

    popoverCancel.addEventListener('click', closeEditor);

    document.getElementById('processes-table').addEventListener('click', e => {
        const cell = e.target.closest('.editable-cell');
        if (cell) openEditor(cell);
    });

    document.getElementById('contract-plan-table').addEventListener('click', e => {
        const cell = e.target.closest('.editable-cell');
        if (cell) openEditor(cell);

        const startButton = e.target.closest('.start-process-btn');
        if (startButton) {
            const planId = parseInt(startButton.dataset.planId);
            openProcessModal(null, planData.find(item => item.id == planId));
        }
    });
    
    document.addEventListener('click', (e) => {
        if (currentEditingCell && !popover.contains(e.target) && !currentEditingCell.contains(e.target)) {
            closeEditor();
        }
        
        const openDropdown = document.querySelector('.action-dropdown.active');
        if (openDropdown && !e.target.closest('.actions-menu-container')) {
            openDropdown.classList.remove('active');
        }
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape") closeEditor();
    });

    function populateFilterModality() {
        const modalitySelect = document.getElementById('filter-analytics-modality');
        modalitySelect.innerHTML = '<option value="">Todos</option>';
        PROCESS_MODALITIES.forEach(m => {
            const option = document.createElement('option');
            option.value = m;
            option.textContent = m;
            modalitySelect.appendChild(option);
        });
    }

    // =================================================================================
    // DRAG & DROP FOR STAT CARDS
    // =================================================================================
    function initializeDraggableCards() {
        const dragContainers = document.querySelectorAll('.dashboard-stats');
    
        dragContainers.forEach(container => {
            loadCardOrder(container);
    
            let draggedCard = null;
    
            container.addEventListener('dragstart', (e) => {
                if (e.target.classList.contains('stat-card')) {
                    draggedCard = e.target;
                    setTimeout(() => {
                        draggedCard.classList.add('dragging');
                    }, 0);
                }
            });
    
            container.addEventListener('dragend', () => {
                if (draggedCard) {
                    draggedCard.classList.remove('dragging');
                    draggedCard = null;
                    saveCardOrder(container);
                }
            });
    
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!draggedCard) return;
    
                const afterElement = getDragAfterElement(container, e.clientY);
                if (afterElement == null) {
                    container.appendChild(draggedCard);
                } else {
                    container.insertBefore(draggedCard, afterElement);
                }
            });
        });
    }
    
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.stat-card:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    function saveCardOrder(container) {
        if (!container.id) return;
        const order = [...container.querySelectorAll('.stat-card')].map(card => card.dataset.cardId);
        localStorage.setItem(`${container.id}-order`, JSON.stringify(order));
    }
    
    function loadCardOrder(container) {
        if (!container.id) return;
        const order = JSON.parse(localStorage.getItem(`${container.id}-order`));
        if (!order) return;
    
        const cards = new Map();
        container.querySelectorAll('.stat-card').forEach(card => {
            if(card.dataset.cardId) {
                cards.set(card.dataset.cardId, card);
            }
        });
    
        order.forEach(cardId => {
            const cardElement = cards.get(cardId);
            if (cardElement) {
                container.appendChild(cardElement);
            }
        });
    }

    // =================================================================================
    // REPORTS SECTION LOGIC
    // =================================================================================
    const reportViewArea = document.getElementById('report-view-area');
    const reportViewContent = document.getElementById('report-view-content');
    const reportViewTitle = document.getElementById('report-view-title');
    const reportPdfButton = document.getElementById('report-pdf-btn');
    const filterReportModal = document.getElementById('filterReportModal');
    
    function drawPdfHeader(doc) {
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 15;

        if (logoImage) {
            doc.addImage(logoImage, 'PNG', margin, 10, 20, 20);
        }
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#333333');
        doc.text('Câmara Municipal de Embu-Guaçu', pageW / 2, 22, { align: 'center' });
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#4361ee');
        doc.text('e-Licitações', pageW - margin, 22, { align: 'right' });
        doc.setLineWidth(0.5);
        doc.setDrawColor('#4361ee');
        doc.line(margin, 35, pageW - margin, 35);
        return 45;
    }


    function openReportFilterModal(reportType) {
        const title = document.getElementById('filter-report-modal-title');
        const generateBtn = document.getElementById('generate-report-with-filters-btn');
        
        document.querySelectorAll('#filterReportModal .form-group').forEach(el => el.style.display = 'none');
        
        if(reportType === 'unified-summary') {
            title.textContent = 'Filtros para Relatório Gerencial';
            document.getElementById('filter-group-month').style.display = 'block';
            document.getElementById('filter-group-status').style.display = 'block';
            document.getElementById('filter-group-priority').style.display = 'block';
            document.getElementById('filter-group-type').style.display = 'block';
        }
        
        generateBtn.dataset.reportType = reportType;
        filterReportModal.classList.add('active');
    }

    document.getElementById('generate-report-with-filters-btn').addEventListener('click', () => {
        const reportType = document.getElementById('generate-report-with-filters-btn').dataset.reportType;
        const filters = {
            month: document.getElementById('report-filter-month').value,
            status: document.getElementById('report-filter-status').value,
            priority: document.getElementById('report-filter-priority').value,
            type: document.getElementById('report-filter-type').value
        };

        showToast('Gerando relatório, por favor aguarde...');

        if (reportType === 'unified-summary') {
            generateUnifiedSummaryReport(filters);
        }

        filterReportModal.classList.remove('active');
    });

    document.querySelectorAll('[data-report-type]').forEach(button => {
        button.addEventListener('click', () => {
            const reportType = button.dataset.reportType;
            openReportFilterModal(reportType);
        });
    });
    
    function generateUnifiedSummaryReport(filters) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const margin = 15;
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        
        let y = drawPdfHeader(doc);

        const performanceData = processesData
            .filter(p => p.fase === 'Contratado' && p.purchasedValue && p.contractDate)
            .map(p => {
                let estimatedValue = p.value;
                if (p.planId) {
                    const planItem = planData.find(item => item.id == p.planId);
                    if (planItem) estimatedValue = planItem.value;
                }
                const economy = parseFloat(estimatedValue || 0) - parseFloat(p.purchasedValue || 0);
                const deadline = new Date(p.deadline + 'T12:00:00');
                const contractDate = new Date(p.contractDate + 'T12:00:00');
                const timeDiff = contractDate.getTime() - deadline.getTime();
                const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                return { ...p, estimatedValue, economy, dayDiff };
            }).filter(p => {
                const contractMonth = new Date(p.contractDate + 'T12:00:00').getMonth().toString();
                const monthMatch = !filters.month || filters.month === contractMonth;
                const typeMatch = !filters.type || p.type === filters.type;
                const priorityMatch = !filters.priority || p.priority === filters.priority;
                return monthMatch && typeMatch && priorityMatch;
            });
        
        const totalExpectedValue = planData
            .filter(p => {
                const deadlineMonth = new Date(p.deadline + 'T12:00:00').getMonth().toString();
                const monthMatch = !filters.month || filters.month === deadlineMonth;
                const typeMatch = !filters.type || p.type === filters.type;
                const priorityMatch = !filters.priority || p.priority === filters.priority;
                return monthMatch && typeMatch && priorityMatch;
            })
            .reduce((sum, p) => sum + p.value, 0);

        const totalSavings = performanceData.reduce((s, p) => (p.economy > 0 ? s + p.economy : s), 0);
        const totalLoss = performanceData.reduce((s, p) => (p.economy < 0 ? s + Math.abs(p.economy) : s), 0);
        const netResult = totalSavings - totalLoss;
        const totalExecutedValue = performanceData.reduce((s, p) => s + parseFloat(p.purchasedValue), 0);
        const onTimeProcesses = performanceData.filter(p => p.dayDiff <= 0);
        const onTimeRate = performanceData.length > 0 ? (onTimeProcesses.length / performanceData.length) * 100 : 0;

        doc.setFontSize(20); doc.setFont('helvetica', 'bold'); doc.setTextColor('#4361ee');
        doc.text('Relatório Gerencial de Contratações', pageW / 2, y, { align: 'center' });
        y += 7;

        const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const appliedFilters = Object.entries(filters)
            .filter(([, value]) => value !== '')
            .map(([key, value]) => {
                let fKey = {'month':'Mês', 'status':'Status', 'priority':'Prioridade', 'type':'Tipo'}[key] || key;
                let fVal = value;
                if (key === 'month' && value) fVal = monthNames[parseInt(value)];
                return `${fKey}: ${fVal}`;
            }).join(' | ');

        doc.setFontSize(9); doc.setTextColor('#888888');
        doc.text(`Filtros Aplicados: ${appliedFilters || 'Nenhum'}`, margin, y);
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageW - margin, y, { align: 'right' });
        y += 10;
        
        const addFooter = () => {
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8); doc.setTextColor(150);
                doc.text(`Página ${i} de ${pageCount}`, pageW / 2, pageH - 10, { align: 'center' });
            }
        };
        const drawSectionTitle = (title) => {
            if (y > pageH - 40) { doc.addPage(); y = drawPdfHeader(doc) - 5; }
            doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor('#3a56d4');
            doc.text(title, margin, y);
            y += 10;
        };
        const drawKpiCard = (x, y, w, h, title, value, subtitle = '', valueColor = '#212529') => {
            doc.setFillColor(248, 249, 250); doc.setDrawColor(222, 226, 230);
            doc.roundedRect(x, y, w, h, 3, 3, 'FD');
            doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor('#6c757d');
            doc.text(title.toUpperCase(), x + 5, y + 7);
            doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.setTextColor(valueColor);
            doc.text(String(value), x + 5, y + 16);
            if (subtitle) {
                doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor('#6c757d');
                doc.text(subtitle, x + 5, y + 21);
            }
        };

        drawSectionTitle('Resumo Executivo');
        const cardW = (pageW - margin * 2 - 10) / 2;
        const cardH = 25;
        drawKpiCard(margin, y, cardW, cardH, 'Resultado Líquido', netResult.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}), `Economia de ${totalSavings.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}`, netResult >= 0 ? '#2a9d8f' : '#e63946');
        drawKpiCard(margin + cardW + 10, y, cardW, cardH, 'Valor Total Executado', totalExecutedValue.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}), `${performanceData.length} processos contratados`);
        y += cardH + 5;
        drawKpiCard(margin, y, cardW, cardH, 'Valor Previsto no Plano', totalExpectedValue.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}), 'Soma dos itens do plano no período');
        drawKpiCard(margin + cardW + 10, y, cardW, cardH, 'Processos no Prazo', `${onTimeRate.toFixed(1)}%`, `${onTimeProcesses.length} de ${performanceData.length} processos`, onTimeRate >= 80 ? '#2a9d8f' : '#e63946');
        y += cardH + 10;

        drawSectionTitle('Análise Financeira por Contratação');
        
        const savingsByContract = performanceData.filter(p => p.economy > 0).sort((a, b) => b.economy - a.economy);
        if (savingsByContract.length > 0) {
            doc.autoTable({
                startY: y,
                head: [['Economia por Contratação', 'Valor Economizado']],
                body: savingsByContract.map(p => [`Nº ${p.processNumber}: ${p.object.substring(0, 50)}...`, p.economy.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})]),
                theme: 'grid',
                headStyles: { fillColor: '#2a9d8f' }
            });
            y = doc.autoTable.previous.finalY + 10;
        }

        const lossesByContract = performanceData.filter(p => p.economy < 0).sort((a, b) => a.economy - b.economy);
        if (lossesByContract.length > 0) {
            doc.autoTable({
                startY: y,
                head: [['Prejuízo por Contratação (Valor Acima do Estimado)', 'Valor do Prejuízo']],
                body: lossesByContract.map(p => [`Nº ${p.processNumber}: ${p.object.substring(0, 50)}...`, Math.abs(p.economy).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})]),
                theme: 'grid',
                headStyles: { fillColor: '#e63946' }
            });
            y = doc.autoTable.previous.finalY + 10;
        }
        
        drawSectionTitle('Análise Operacional Detalhada');

        const modalityAnalysis = performanceData.reduce((acc, p) => {
            const mod = p.modality || 'Não Definida';
            if (!acc[mod]) acc[mod] = { count: 0, totalValue: 0, totalEconomy: 0 };
            acc[mod].count++;
            acc[mod].totalValue += parseFloat(p.purchasedValue);
            acc[mod].totalEconomy += p.economy;
            return acc;
        }, {});

        doc.autoTable({
            startY: y,
            head: [['Análise por Modalidade', 'Nº Contratos', 'Valor Total', 'Economia Total']],
            body: Object.entries(modalityAnalysis).map(([mod, data]) => [
                mod,
                data.count,
                data.totalValue.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}),
                data.totalEconomy.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})
            ]),
            theme: 'striped',
            headStyles: { fillColor: '#4361ee' }
        });
        y = doc.autoTable.previous.finalY + 10;
        
        const priorityAnalysis = performanceData.reduce((acc, p) => {
            const prio = p.priority || 'Não Definida';
            if (!acc[prio]) acc[prio] = { count: 0, totalValue: 0, totalEconomy: 0 };
            acc[prio].count++;
            acc[prio].totalValue += parseFloat(p.purchasedValue);
            acc[prio].totalEconomy += p.economy;
            return acc;
        }, {});

        const priorityOrder = ['Alta', 'Média', 'Baixa', 'Não Definida'];
        const sortedPriorityData = Object.entries(priorityAnalysis).sort(([a], [b]) => {
            return priorityOrder.indexOf(a) - priorityOrder.indexOf(b);
        });

        doc.autoTable({
            startY: y,
            head: [['Análise por Prioridade', 'Nº Contratos', 'Valor Total Contratado', 'Economia Média']],
            body: sortedPriorityData.map(([prio, data]) => [
                prio,
                data.count,
                data.totalValue.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}),
                (data.count > 0 ? (data.totalEconomy / data.count) : 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'})
            ]),
            theme: 'striped',
            headStyles: { fillColor: '#4361ee' }
        });
        
        addFooter();
        doc.save(`Relatorio_Gerencial_${new Date().toISOString().slice(0,10)}.pdf`);
    }

    async function generateRichProcessPdf(processId) {
        const process = processesData.find(p => p.id == processId);
        if (!process) {
            showToast('Erro: Processo não encontrado.');
            return;
        }

        showToast(`Gerando PDF para o processo Nº ${process.processNumber || 'S/N'}...`);

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 15;
        
        let y = drawPdfHeader(doc);
        
        doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor('#333333');
        doc.text(`Acompanhamento do Processo Nº: ${process.processNumber || 'S/N'}`, margin, y);
        doc.setFontSize(9); doc.setTextColor('#888888');
        doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageW - margin, y, { align: 'right' });
        y += 8;

        doc.setFontSize(10); doc.setTextColor('#333333'); doc.setFont('helvetica', 'bold');
        doc.text('Objeto:', margin, y);
        doc.setFont('helvetica', 'normal');
        const objectLines = doc.splitTextToSize(process.object, pageW - (margin * 2) - 15);
        doc.text(objectLines, margin + 15, y);
        y += (objectLines.length * 4) + 8;

        const drawPdfSectionTitle = (doc, y, title, margin) => {
            doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor('#3a56d4');
            doc.text(title, margin, y);
            return y + 8;
        };

        y = drawPdfSectionTitle(doc, y, 'Detalhes Gerais', margin);
        
        let estimatedValue = process.value;
        if (process.planId) {
            const planItem = planData.find(item => item.id == process.planId);
            if (planItem) estimatedValue = planItem.value;
        }
        const economy = (process.purchasedValue && estimatedValue) ? (parseFloat(estimatedValue) - parseFloat(process.purchasedValue)) : null;
        
        const details = {
            'Status Atual': process.fase, 'Prioridade': process.priority, 'Tipo': process.type,
            'Modalidade': process.modality || 'A definir',
            'Valor Estimado': parseFloat(estimatedValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            'Valor Contratado': process.purchasedValue ? parseFloat(process.purchasedValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A',
            'Economia': economy !== null ? economy.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A',
            'Prazo Limite': process.deadline ? new Date(process.deadline + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A',
            'Data da Contratação': process.contractDate ? new Date(process.contractDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A',
            'Localização': `${process.location.sector} ${process.location.responsible ? `(${process.location.responsible})` : ''}`,
            'Vinculado ao Plano': process.planId ? `Sim (Item ${process.planId})` : 'Não'
        };
        
        const colWidth = (pageW - margin * 2) / 3;
        const detailEntries = Object.entries(details);
        
        detailEntries.forEach(([label, value], i) => {
            const col = i % 3;
            if (col === 0 && i > 0) y += 15;
            const x = margin + (col * colWidth);
            
            doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor('#6c757d');
            doc.text(label.toUpperCase(), x, y);
            doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor('#333333');
            doc.text(String(value), x, y + 5);
        });
        y += 20;

        const phaseHead = [['Fase', 'Início', 'Fim', 'Duração']];
        const phaseBody = (process.history || []).map(entry => {
            if (entry.fase === 'Contratado') {
                return [
                    entry.fase,
                    new Date(entry.startDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}),
                    '-',
                    '-'
                ];
            } else {
                return [
                    entry.fase,
                    new Date(entry.startDate).toLocaleString('pt-BR'),
                    entry.endDate ? new Date(entry.endDate).toLocaleString('pt-BR') : 'Fase Atual',
                    formatDuration(entry.startDate, entry.endDate)
                ];
            }
        });
        y = drawPdfSectionTitle(doc, y, 'Histórico de Fases', margin);
        doc.autoTable({ head: phaseHead, body: phaseBody, startY: y, headStyles: { fillColor: '#4361ee' } });
        y = doc.autoTable.previous.finalY + 10;

        const locationHead = [['Setor', 'Responsável', 'Início', 'Fim', 'Duração']];
        const locationBody = (process.locationHistory || []).map(entry => [ entry.sector || 'N/A', entry.responsible || '-', new Date(entry.startDate).toLocaleString('pt-BR'), entry.endDate ? new Date(entry.endDate).toLocaleString('pt-BR') : 'Local Atual', formatDuration(entry.startDate, entry.endDate) ]);
        y = drawPdfSectionTitle(doc, y, 'Histórico de Localizações', margin);
        doc.autoTable({ head: locationHead, body: locationBody, startY: y, headStyles: { fillColor: '#4361ee' } });
        y = doc.autoTable.previous.finalY + 10;
        
        doc.save(`Acompanhamento_Processo_${process.processNumber || process.id}.pdf`);
    }

    function generateProcessTrackingReport(processId) {
        if (!processId) {
            reportViewArea.classList.add('hidden-field');
            return;
        }
    
        const process = processesData.find(p => p.id == processId);
        if (!process) {
            showToast('Processo não encontrado.');
            reportViewArea.classList.add('hidden-field');
            return;
        }
    
        const reportTitle = `Acompanhamento do Processo Nº ${process.processNumber || 'S/N'}`;
        const reportContainer = document.createElement('div');

        let estimatedValue = process.value;
        if (process.planId) {
            const planItem = planData.find(item => item.id == process.planId);
            if (planItem) estimatedValue = planItem.value;
        }

        const summaryDetails = {
            'Objeto': process.object,
            'Fase Atual': `<span class="process-status status-${process.fase.replace(/ /g, '-')}">${process.fase}</span>`,
            'Valor Estimado': parseFloat(estimatedValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            'Valor Final': process.purchasedValue ? parseFloat(process.purchasedValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A',
            'Localização Atual': `${process.location.sector} ${process.location.responsible ? `(${process.location.responsible})` : ''}`.trim(),
            'Prazo Final': process.deadline ? new Date(process.deadline + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'
        };
        
        reportContainer.innerHTML = `<div class="info-grid">${Object.entries(summaryDetails).map(([label, value]) => `
            <div class="info-item">
                <span class="info-label">${label}</span>
                <span class="info-value">${value}</span>
            </div>`).join('')}
        </div>`;
        
        const phaseHistoryContainer = document.createElement('div');
        phaseHistoryContainer.className = 'processes-table-container';
        phaseHistoryContainer.innerHTML = `
            <h4 class="tracking-table-title">Histórico de Fases</h4>
            <table class="processes-table">
                <thead><tr><th>Fase</th><th>Data de Início</th><th>Data de Fim</th><th>Duração</th></tr></thead>
                <tbody>
                    ${(process.history && process.history.length > 0) ? process.history.map(entry => `
                        <tr>
                            <td><span class="process-status status-${entry.fase.replace(/ /g, '-')}">${entry.fase}</span></td>
                            <td>${new Date(entry.startDate).toLocaleString('pt-BR')}</td>
                            <td>${entry.endDate ? new Date(entry.endDate).toLocaleString('pt-BR') : 'Fase Atual'}</td>
                            <td>${formatDuration(entry.startDate, entry.endDate)}</td>
                        </tr>`).join('') : '<tr><td colspan="4">Nenhum histórico de fase.</td></tr>'}
                </tbody>
            </table>`;
    
        const locationHistoryContainer = document.createElement('div');
        locationHistoryContainer.className = 'processes-table-container';
        locationHistoryContainer.style.marginTop = '1.5rem';
        locationHistoryContainer.innerHTML = `
            <h4 class="tracking-table-title">Histórico de Localizações</h4>
            <table class="processes-table">
                <thead><tr><th>Setor</th><th>Responsável</th><th>Data de Início</th><th>Data de Fim</th><th>Duração</th></tr></thead>
                <tbody>
                    ${(process.locationHistory && process.locationHistory.length > 0) ? process.locationHistory.map(entry => `
                        <tr>
                            <td>${entry.sector || 'N/A'}</td>
                            <td>${entry.responsible || '-'}</td>
                            <td>${new Date(entry.startDate).toLocaleString('pt-BR')}</td>
                            <td>${entry.endDate ? new Date(entry.endDate).toLocaleString('pt-BR') : 'Local Atual'}</td>
                            <td>${formatDuration(entry.startDate, entry.endDate)}</td>
                        </tr>`).join('') : '<tr><td colspan="5">Nenhum histórico de localização.</td></tr>'}
                </tbody>
            </table>`;
        
        reportContainer.appendChild(phaseHistoryContainer);
        reportContainer.appendChild(locationHistoryContainer);
        
        reportViewContent.innerHTML = '';
        reportViewContent.appendChild(reportContainer);
        reportViewTitle.textContent = reportTitle;
        
        reportPdfButton.dataset.processId = process.id;
        
        reportViewArea.classList.remove('hidden-field');
        reportViewArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
        
    function renderReportsTab() {
        const searchInput = document.getElementById('report-process-search');
        const searchList = document.getElementById('report-process-list');
        
        const sortedProcesses = [...processesData].sort((a, b) => 
            (a.processNumber || "").localeCompare(b.processNumber || "", undefined, {numeric: true})
        );
    
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            if (!searchTerm) {
                searchList.innerHTML = '';
                searchList.classList.remove('active');
                return;
            }
    
            const filtered = sortedProcesses.filter(p => 
                p.processNumber?.toLowerCase().includes(searchTerm) || p.object.toLowerCase().includes(searchTerm)
            );
    
            searchList.innerHTML = '';
            if (filtered.length > 0) {
                filtered.forEach(p => {
                    const item = document.createElement('div');
                    item.className = 'searchable-select-item';
                    item.dataset.id = p.id;
                    item.innerHTML = `<strong>Nº ${p.processNumber || 'S/N'}</strong> <small>${p.object}</small>`;
                    searchList.appendChild(item);
                });
                searchList.classList.add('active');
            } else {
                searchList.classList.remove('active');
            }
        });
    
        searchList.addEventListener('click', (e) => {
            const item = e.target.closest('.searchable-select-item');
            if (item) {
                generateProcessTrackingReport(item.dataset.id);
                searchInput.value = '';
                searchList.classList.remove('active');
            }
        });
    
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.searchable-select-container')) {
                searchList.classList.remove('active');
            }
        });
    }
    
    function formatDuration(start, end) {
        if (!start) return 'N/A';
        const startDate = new Date(start);
        const endDate = end ? new Date(end) : new Date();
        const diffMs = endDate - startDate;
        if (diffMs < 0) return 'N/A';
        const days = Math.floor(diffMs / 86400000);
        const hours = Math.floor((diffMs % 86400000) / 3600000);
        const minutes = Math.floor((diffMs % 3600000) / 60000);
        let result = '';
        if (days > 0) result += `${days}d `;
        if (hours > 0) result += `${hours}h `;
        if (minutes > 0) result += `${minutes}m`;
        return result.trim() || 'Menos de 1 min';
    }
    
    reportPdfButton.addEventListener('click', () => {
        const processId = reportPdfButton.dataset.processId;
        if (processId) {
            generateRichProcessPdf(processId);
        } else {
            showToast('Nenhum processo selecionado para gerar PDF.');
        }
    });

    // =================================================================================
    // UTILITIES
    // =================================================================================

    const backToTopButton = document.getElementById('back-to-top-btn');
    if (backToTopButton) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 250) {
                backToTopButton.classList.add('show');
            } else {
                backToTopButton.classList.remove('show');
            }
        });
        backToTopButton.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

    document.querySelectorAll('.btn-go-to-dashboard').forEach(btn => {
        btn.addEventListener('click', () => {
            const dashboardNavItem = document.querySelector('.nav-item[data-section="dashboards"]');
            if (dashboardNavItem) {
                dashboardNavItem.click();
            }
        });
    });

    function checkFilterActivity() {
        const processSearch = document.getElementById('filter-search-process').value;
        const processStatus = document.getElementById('filter-status').value;
        const processType = document.getElementById('filter-type').value;
        document.getElementById('clear-process-filters').style.display = (processSearch || processStatus || processType) ? 'flex' : 'none';

        const planSearch = document.getElementById('filter-search-plan').value;
        document.getElementById('clear-plan-filters').style.display = planSearch ? 'flex' : 'none';

        const analyticsMonth = document.getElementById('filter-analytics-month').value;
        const analyticsType = document.getElementById('filter-analytics-type').value;
        const analyticsModality = document.getElementById('filter-analytics-modality').value;
        document.getElementById('clear-analytics-filters').style.display = (analyticsMonth || analyticsType || analyticsModality) ? 'flex' : 'none';
    }

    document.getElementById('clear-process-filters').addEventListener('click', () => {
        document.getElementById('filter-search-process').value = '';
        document.getElementById('filter-status').value = '';
        document.getElementById('filter-type').value = '';
        populateProcessesTable();
        checkFilterActivity();
    });

    document.getElementById('clear-plan-filters').addEventListener('click', () => {
        document.getElementById('filter-search-plan').value = '';
        populateContractPlanTable(planData);
        checkFilterActivity();
    });

    document.getElementById('clear-analytics-filters').addEventListener('click', () => {
        document.getElementById('filter-analytics-month').value = '';
        document.getElementById('filter-analytics-type').value = '';
        document.getElementById('filter-analytics-modality').value = '';
        renderAnalyticsDashboard();
        checkFilterActivity();
    });


    // =================================================================================
    // INITIALIZATION
    // =================================================================================
    
    const preloadLogo = () => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = 'logo.png'; 
            img.onload = () => {
                logoImage = img; 
                resolve();
            };
            img.onerror = () => {
                console.error('Falha ao carregar a imagem do logo. Verifique se o arquivo \"logo.png\" está na pasta correta.');
                showToast('Erro: Falha ao carregar o logo para os relatórios.');
                reject();
            };
        });
    };

    const initializeApp = async () => {
        const theme = localStorage.getItem('theme') || 'dark';
        if (theme === 'light') {
            document.body.classList.remove('theme-dark');
            document.body.classList.add('theme-light');
            document.getElementById('theme-toggle').checked = false;
        } else {
            document.body.classList.remove('theme-light');
            document.body.classList.add('theme-dark');
            document.getElementById('theme-toggle').checked = true;
        }

        await preloadLogo(); 
        await Promise.all([fetchProcesses(), fetchPlan()]);
        populateFilterModality();
        renderApp();
        renderReportsTab();
        checkAlerts();
        checkFilterActivity();
    };

    document.getElementById('process-value').addEventListener('input', formatarValorBRL);
    document.getElementById('process-purchasedValue').addEventListener('input', formatarValorBRL);
    document.getElementById('contract-purchasedValue').addEventListener('input', formatarValorBRL);

    document.getElementById('theme-toggle').addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        document.body.classList.toggle('theme-light', !isChecked);
        document.body.classList.toggle('theme-dark', isChecked);
        localStorage.setItem('theme', isChecked ? 'dark' : 'light');
    });

    initializeApp();
    initializeDraggableCards();
});

