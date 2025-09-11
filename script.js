document.addEventListener('DOMContentLoaded', () => {

    // =================================================================================
    // CONFIGURAÇÃO DO SERVIDOR - PASSO FINAL E OBRIGATÓRIO!
    // SUBSTITUA O URL ABAIXO PELO SEU URL PÚBLICO FORNECIDO PELO RENDER.COM
    // =================================================================================
    const API_BASE_URL = 'https://antonio-licitacoes-api.onrender.com'; 

    // O resto do código usará a variável acima automaticamente.
    const PLAN_API_URL = `${API_BASE_URL}/api/plan`;
    const PROCESSES_API_URL = `${API_BASE_URL}/api/processes`;
    const UPLOADS_BASE_URL = `${API_BASE_URL}/uploads`;
    
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
            const response = await fetch(PLAN_API_URL);
            if (!response.ok) throw new Error('Erro ao buscar plano anual.');
            planData = await response.json();
            planData.forEach(item => {
                if (item.priority === 'Mídia') {
                    item.priority = 'Média';
                }
            });
        } catch (error) {
            console.error(error);
            showToast('Falha ao carregar o plano anual do servidor.');
        }
    };

    const fetchProcesses = async () => {
        try {
            const response = await fetch(PROCESSES_API_URL);
            if (!response.ok) throw new Error('Erro ao buscar processos.');
            processesData = await response.json();
        } catch (error) {
            console.error(error);
            showToast('Falha ao carregar os processos do servidor.');
        }
    };

    const addProcess = async (data) => {
        try {
            const isFormData = data instanceof FormData;
            await fetch(PROCESSES_API_URL, {
                method: 'POST',
                headers: isFormData ? {} : { 'Content-Type': 'application/json' },
                body: isFormData ? data : JSON.stringify(data)
            });
        } catch (error) {
            console.error('Erro ao adicionar processo:', error);
            showToast('Falha ao adicionar processo.');
        }
    };

    const updateProcess = async (id, data) => {
        try {
            const isFormData = data instanceof FormData;
            const response = await fetch(`${PROCESSES_API_URL}/${id}`, {
                method: 'PUT',
                headers: isFormData ? {} : { 'Content-Type': 'application/json' },
                body: isFormData ? data : JSON.stringify(data)
            });
            if (!response.ok) throw new Error('Falha na resposta do servidor');
        } catch (error) {
            console.error('Erro ao atualizar processo:', error);
            showToast('Falha ao atualizar processo.');
        }
    };

    const deleteProcess = async (id) => {
        try {
            await fetch(`${PROCESSES_API_URL}/${id}`, { method: 'DELETE' });
            showToast('Processo excluído.');
        } catch (error)
        {
            showToast('Falha ao excluir processo.');
        }
    };

    const destroyChart = (chartId) => {
        if (chartInstances[chartId]) {
            chartInstances[chartId].destroy();
            delete chartInstances[chartId];
        }
    };
    
    // =================================================================================
    // RENDER FUNCTIONS
    // =================================================================================
    function renderProcessDashboard() {
        destroyChart('statusChart');
        destroyChart('valueByMonthChart');
        
        document.getElementById('stat-active').textContent = processesData.length;
        document.getElementById('stat-upcoming').textContent = processesData.filter(p => p.fase === 'Em Licitação').length;
        
        const contractedCount = processesData.filter(p => p.fase === 'Contratado').length;
        document.getElementById('stat-value').textContent = contractedCount;
        document.querySelector('[data-card-id="contratados"] .stat-title').textContent = 'Contratados';
        document.querySelector('[data-card-id="contratados"] .stat-change').textContent = 'Total de processos contratados';
        document.querySelector('[data-card-id="contratados"]').dataset.filterStatus = 'Contratado';

        document.getElementById('stat-overdue').textContent = processesData.filter(p => p.fase === 'Planejamento' || p.fase === 'Em Licitação').length;
        
        const statusCounts = PROCESS_PHASES.reduce((acc, phase) => {
            acc[phase] = processesData.filter(p => p.fase === phase).length;
            return acc;
        }, {});

        chartInstances['statusChart'] = new Chart(document.getElementById('statusChart').getContext('2d'), {
            type: 'doughnut', data: { labels: Object.keys(statusCounts), datasets: [{ data: Object.values(statusCounts), backgroundColor: CHART_COLORS, borderColor: 'var(--card-bg)', borderWidth: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom', labels: { color: 'var(--text-secondary)' } } } }
        });

        const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const planValueByMonth = Array(12).fill(0);
        planData.forEach(p => {
            if (p.deadline) {
                const month = new Date(p.deadline + 'T00:00:00').getMonth();
                planValueByMonth[month] += p.value;
            }
        });

        const contractedValueByMonth = Array(12).fill(0);
        processesData
            .filter(p => p.fase === 'Contratado' && p.purchasedValue && p.contractDate)
            .forEach(p => {
                const month = new Date(p.contractDate + 'T00:00:00').getMonth();
                if(month >= 0 && month < 12) {
                    contractedValueByMonth[month] += parseFloat(p.purchasedValue);
                }
            });

        chartInstances['valueByMonthChart'] = new Chart(document.getElementById('valueByMonthChart').getContext('2d'), {
            type: 'bar',
            data: {
                labels: months,
                datasets: [{
                    label: 'Valor Planejado',
                    data: planValueByMonth,
                    backgroundColor: 'rgba(107, 114, 128, 0.7)',
                    borderRadius: 4
                }, {
                    label: 'Valor Contratado',
                    data: contractedValueByMonth,
                    backgroundColor: CHART_COLORS[2],
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: { position: 'top', labels: { color: 'var(--text-secondary)' } },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.dataset.label}: ${context.parsed.y.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                        }
                    }
                },
                scales: {
                    y: { ticks: { callback: (v) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v), color: 'var(--text-secondary)' }, grid: { color: 'var(--card-border)' } },
                    x: { ticks: { color: 'var(--text-secondary)' }, grid: { display: false } }
                }
            }
        });
    }

    function renderPlanDashboard() {
        destroyChart('planStatusChart');
        destroyChart('planValueByMonthChart');
        const totalValue = planData.reduce((sum, item) => sum + item.value, 0);
        document.getElementById('plan-total-value').textContent = totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const initiatedPlanIds = new Set(processesData.map(p => parseInt(p.planId, 10)).filter(id => !isNaN(id)));
        
        const contractedPlanIds = new Set(
            processesData
                .filter(p => p.planId && p.fase === 'Contratado')
                .map(p => parseInt(p.planId, 10))
                .filter(id => !isNaN(id))
        );
        
        const executedValue = processesData
            .filter(p => p.planId && p.fase === 'Contratado' && p.purchasedValue)
            .reduce((sum, p) => sum + parseFloat(p.purchasedValue || 0), 0);
        document.getElementById('plan-executed-value').textContent = executedValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const progress = planData.length > 0 ? (initiatedPlanIds.size / planData.length) * 100 : 0;
        document.getElementById('plan-progress').textContent = `${progress.toFixed(1)}%`;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thirtyDaysFromNow = new Date(new Date().setDate(today.getDate() + 30));
        
        const upcomingItems = planData.filter(item => {
            if (!item.deadline) return false;
            const deadline = new Date(item.deadline + 'T00:00:00');
            const isWithinWindow = deadline <= thirtyDaysFromNow && deadline >= today;
            const isNotInitiated = !initiatedPlanIds.has(parseInt(item.id, 10));
            return isWithinWindow && isNotInitiated;
        }).length;
        document.getElementById('plan-upcoming-items').textContent = upcomingItems;
        
        const overdueItems = planData.filter(item => {
            if (!item.deadline) return false;
            const deadline = new Date(item.deadline + 'T00:00:00');
            const isOverdue = deadline < today;
            const isNotContracted = !contractedPlanIds.has(parseInt(item.id, 10));
            return isOverdue && isNotContracted;
        }).length;
        document.getElementById('plan-overdue-items').textContent = overdueItems;

        const planStatusCounts = {
            "Não Iniciado": planData.filter(item => !initiatedPlanIds.has(parseInt(item.id, 10))).length,
            "Em Andamento": Array.from(initiatedPlanIds).filter(id => {
                const process = processesData.find(p => parseInt(p.planId, 10) === id);
                return process && process.fase !== 'Contratado';
            }).length,
            "Executado": contractedPlanIds.size
        };

        chartInstances['planStatusChart'] = new Chart(document.getElementById('planStatusChart').getContext('2d'), {
            type: 'pie', data: { labels: Object.keys(planStatusCounts), datasets: [{ data: Object.values(planStatusCounts), backgroundColor: ['#6b7280', CHART_COLORS[0], CHART_COLORS[1]], borderColor: 'var(--card-bg)', borderWidth: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom', labels: { color: 'var(--text-secondary)' } } } }
        });

        const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const planValueByMonth = Array(12).fill(0);
        planData.forEach(p => { 
            if (p.deadline) {
                const month = new Date(p.deadline + 'T00:00:00').getMonth(); 
                planValueByMonth[month] += p.value;
            }
        });

        chartInstances['planValueByMonthChart'] = new Chart(document.getElementById('planValueByMonthChart').getContext('2d'), {
            type: 'line', data: { labels: months, datasets: [{ label: 'Valor Planejado', data: planValueByMonth, backgroundColor: 'rgba(90, 103, 216, 0.1)', borderColor: CHART_COLORS[0], tension: 0.3, fill: true }] },
            options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { y: { ticks: { callback: (v) => new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v), color: 'var(--text-secondary)' }, grid: { color: 'var(--card-border)' } }, x: { ticks: { color: 'var(--text-secondary)' }, grid: { display: false } } } }
        });
    }

    function populateContractPlanTable(data = planData) {
        const tableBody = document.getElementById('contract-plan-table').querySelector('tbody');
        tableBody.innerHTML = '';
        
        data.forEach(p => {
            const row = tableBody.insertRow();
            const processInfo = processesData.find(process => parseInt(process.planId, 10) === parseInt(p.id, 10));
            const status = processInfo ? processInfo.fase : "Não Iniciado";
            
            const statusHtml = `<td class="editable-cell" data-id="${p.id}" data-field="status">
                                    <span class="process-status status-${status.replace(/ /g, '-')}">${status}</span>
                                  </td>`;
            
            const actionHtml = status !== "Não Iniciado" 
                ? `<button class="btn" disabled style="padding: 0.2rem 0.8rem; font-size: 0.8rem;">Iniciado</button>` 
                : `<button class="btn btn-primary start-process-btn" data-plan-id="${p.id}" style="padding: 0.2rem 0.8rem; font-size: 0.8rem;"><i class="fas fa-play"></i> Iniciar</button>`;

            row.innerHTML = `
                <td>${p.id}</td>
                <td><strong>${p.object.toUpperCase()}</strong></td>
                <td>${p.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td><span class="card-priority priority-${p.priority}">${p.priority}</span></td>
                <td>${p.deadline ? new Date(p.deadline + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</td>
                ${statusHtml}
                <td>${actionHtml}</td>`;
        });
    }
    
    function populateProcessesTable() {
        const tableBody = document.getElementById('processes-table').querySelector('tbody');
        tableBody.innerHTML = '';
        
        const filteredAndSortedData = getFilteredData().sort((a, b) => {
            const aIsImportant = a.isImportant || false;
            const bIsImportant = b.isImportant || false;
            if (aIsImportant !== bIsImportant) {
                return bIsImportant - aIsImportant;
            }
            return (a.processNumber || "").localeCompare(b.processNumber || "", undefined, { numeric: true });
        });

        filteredAndSortedData.forEach(p => {
            const isImportant = p.isImportant;
            const importantClass = isImportant ? 'important' : '';
            const starIcon = isImportant ? 'fas fa-star' : 'far fa-star';
            const rowClass = isImportant ? 'important-row' : '';

            const row = tableBody.insertRow();
            row.dataset.processId = p.id;
            row.className = rowClass;
            
            row.innerHTML = `
                <td><span class="process-number-clickable" data-id="${p.id}">${p.processNumber || ''}</span></td>
                <td><span class="process-object-clickable" data-id="${p.id}"><strong>${p.object.toUpperCase()}</strong></span></td>
                <td class="editable-cell" data-id="${p.id}" data-field="fase"><span class="process-status status-${p.fase.replace(/ /g, '-')}">${p.fase}</span></td>
                <td class="editable-cell" data-id="${p.id}" data-field="modality">${p.modality || 'A definir'}</td>
                <td class="editable-cell" data-id="${p.id}" data-field="location">${p.location.sector}</td>
                <td class="actions-cell">
                    <button class="btn-action-icon btn-importante ${importantClass}" data-id="${p.id}" data-tooltip="Marcar/Desmarcar Importante">
                        <i class="${starIcon}"></i>
                    </button>
                    <button class="btn-action-icon btn-alterar" data-id="${p.id}" data-tooltip="Alterar"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-action-icon btn-excluir" data-id="${p.id}" data-tooltip="Excluir">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>`;
        });
    }

    function getFilteredAnalyticsData() {
        const selectedMonth = document.getElementById('filter-analytics-month').value;
        const selectedType = document.getElementById('filter-analytics-type').value;
        const selectedModality = document.getElementById('filter-analytics-modality').value;

        const contractedProcesses = processesData
            .filter(p => p.fase === 'Contratado' && p.purchasedValue && p.contractDate);

        const analyticsData = contractedProcesses.map(p => {
            let estimatedValue = p.value;
            if (p.planId) {
                const planItem = planData.find(item => parseInt(item.id, 10) === parseInt(p.planId, 10));
                if (planItem) {
                    estimatedValue = planItem.value;
                }
            }
            return { ...p, estimatedValue };
        });

        return analyticsData.filter(p => {
            const monthMatch = selectedMonth ? new Date(p.contractDate + 'T00:00:00').getMonth() == selectedMonth : true;
            const typeMatch = selectedType ? p.type === selectedType : true;
            const modalityMatch = selectedModality ? p.modality === selectedModality : true;
            return monthMatch && typeMatch && modalityMatch;
        });
    }

    function renderAnalyticsDashboard() {
        const filteredData = getFilteredAnalyticsData();
        
        const totalEconomy = filteredData.reduce((acc, p) => acc + (parseFloat(p.estimatedValue || 0) - parseFloat(p.purchasedValue || 0)), 0);
        const totalEstimated = filteredData.reduce((acc, p) => acc + parseFloat(p.estimatedValue || 0), 0);
        const economyPercentage = totalEstimated > 0 ? (totalEconomy / totalEstimated) * 100 : 0;
        
        const onTimeProcesses = filteredData.filter(p => {
            if (!p.contractDate || !p.deadline) return false;
            const contractDate = new Date(p.contractDate + 'T00:00:00');
            const deadline = new Date(p.deadline + 'T00:00:00');
            return contractDate <= deadline;
        });

        const onTimeRate = filteredData.length > 0 ? (onTimeProcesses.length / filteredData.length) * 100 : 0;

        document.getElementById('analytics-total-economy').textContent = totalEconomy.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        document.getElementById('analytics-economy-percentage').textContent = `${economyPercentage.toFixed(1)}%`;
        document.getElementById('analytics-on-time-rate').textContent = `${onTimeRate.toFixed(1)}%`;

        const tableBody = document.getElementById('analytics-table').querySelector('tbody');
        tableBody.innerHTML = '';
        
        filteredData.forEach(p => {
            const row = tableBody.insertRow();
            const economy = parseFloat(p.estimatedValue || 0) - parseFloat(p.purchasedValue || 0);
            const economyPerc = parseFloat(p.estimatedValue) > 0 ? (economy / parseFloat(p.estimatedValue)) * 100 : 0;
            const economyClass = economy > 0 ? 'economy-positive' : economy < 0 ? 'economy-negative' : 'economy-neutral';

            const deadline = new Date(p.deadline + 'T00:00:00');
            const contractDate = new Date(p.contractDate + 'T00:00:00');
            const timeDiff = deadline.getTime() - contractDate.getTime();
            const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

            let deadlineAnalysis = '';
            if (dayDiff > 0) {
                deadlineAnalysis = `<span class="economy-positive">${dayDiff} dia(s) adiantado</span>`;
            } else if (dayDiff < 0) {
                deadlineAnalysis = `<span class="economy-negative">${Math.abs(dayDiff)} dia(s) atrasado</span>`;
            } else {
                deadlineAnalysis = `<span class="economy-neutral">No prazo</span>`;
            }
            
            row.innerHTML = `
                <td>${p.processNumber}</td>
                <td>${p.object}</td>
                <td>${parseFloat(p.estimatedValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td>${parseFloat(p.purchasedValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td class="${economyClass}">${economy.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (${economyPerc.toFixed(1)}%)</td>
                <td>${p.deadline ? new Date(p.deadline + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</td>
                <td>${p.contractDate ? new Date(p.contractDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A'}</td>
                <td>${deadlineAnalysis}</td>
            `;
        });
    }

    function renderApp() {
        renderProcessDashboard();
        renderPlanDashboard();
        populateContractPlanTable();
        populateProcessesTable();
        renderAnalyticsDashboard();
    }
    
    // =================================================================================
    // CORE LOGIC & EVENT LISTENERS
    // =================================================================================

    function getFilteredData() {
        const status = document.getElementById('filter-status').value;
        const type = document.getElementById('filter-type').value;
        const searchTerm = document.getElementById('filter-search-process').value.toLowerCase();
        
        let data = processesData;

        if (activeProcessFilter) {
            if (activeProcessFilter === 'active') {
                data = data.filter(p => p.fase !== 'Contratado');
            } else if (activeProcessFilter === 'pending') {
                data = data.filter(p => p.fase === 'Planejamento' || p.fase === 'Em Licitação');
            }
        }

        return data.filter(p => {
            const searchMatch = searchTerm ?
                (p.processNumber?.toLowerCase().includes(searchTerm) || p.object.toLowerCase().includes(searchTerm))
                : true;

            return (status ? p.fase === status : true) && 
                   (type ? p.type === type : true) && 
                   searchMatch;
        });
    }
    
    function toggleContractFields(status) {
        const contractDateGroup = document.getElementById('contract-date-group');
        const purchasedValueGroup = document.getElementById('purchased-value-group');
        if (status === 'Contratado') {
            contractDateGroup.classList.remove('hidden-field');
            purchasedValueGroup.classList.remove('hidden-field');
        } else {
            contractDateGroup.classList.add('hidden-field');
            purchasedValueGroup.classList.add('hidden-field');
        }
    }

    function openProcessModal(processId = null, planItem = null) {
        const form = document.getElementById('processForm');
        form.reset();
        document.getElementById('process-id').value = '';
        document.getElementById('file-list-display').innerHTML = '';

        const modalitySelect = document.getElementById('process-modality');
        modalitySelect.innerHTML = '';
        PROCESS_MODALITIES.forEach(m => {
            const option = document.createElement('option');
            option.value = m;
            option.textContent = m;
            modalitySelect.appendChild(option);
        });

        const existingPlanIdInput = form.querySelector('#process-plan-id');
        if (existingPlanIdInput) existingPlanIdInput.remove();

        const startDateGroup = document.getElementById('start-date-group');
        const startDateInput = document.getElementById('process-startDate');
        const processNumberInput = document.getElementById('process-number');
        
        const logHistoryGroup = document.getElementById('log-history-group');

        if (processId) {
            const process = processesData.find(p => p.id == processId);
            document.getElementById('modal-title').textContent = 'Editar Processo';
            document.getElementById('modal-submit-btn').textContent = 'Salvar Alterações';
            document.getElementById('process-id').value = process.id;
            
            Object.keys(process).forEach(key => {
                const element = document.getElementById(`process-${key}`);
                if (element) element.value = process[key];
            });
            
            const valueInput = document.getElementById('process-value');
            const purchasedValueInput = document.getElementById('process-purchasedValue');
            valueInput.value = parseFloat(process.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            if(process.purchasedValue) {
                purchasedValueInput.value = parseFloat(process.purchasedValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            } else {
                purchasedValueInput.value = '';
            }

            document.getElementById('process-number').value = process.processNumber;
            document.getElementById('process-sector').value = process.location.sector;
            document.getElementById('process-responsible').value = process.location.responsible;
            document.getElementById('process-status').value = process.fase;
            document.getElementById('process-contractDate').value = process.contractDate || '';
            
            startDateGroup.classList.remove('hidden-field');
            startDateInput.value = process.creationDate.split('T')[0];
            startDateInput.required = true;

            logHistoryGroup.classList.remove('hidden-field');
            document.getElementById('log-history-checkbox').checked = true;

        } else if (planItem) {
            document.getElementById('modal-title').textContent = 'Iniciar Processo do Plano Anual';
            document.getElementById('modal-submit-btn').textContent = 'Criar Processo';
            document.getElementById('process-object').value = planItem.object;
            document.getElementById('process-value').value = parseFloat(planItem.value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            document.getElementById('process-deadline').value = planItem.deadline;
            document.getElementById('process-priority').value = planItem.priority;
            document.getElementById('process-type').value = planItem.type;
            document.getElementById('process-status').value = 'Planejamento';
            
            const planIdInput = document.createElement('input');
            planIdInput.type = 'hidden';
            planIdInput.id = 'process-plan-id';
            planIdInput.value = planItem.id;
            form.appendChild(planIdInput);

            startDateGroup.classList.remove('hidden-field');
            startDateInput.value = new Date().toISOString().split("T")[0];
            startDateInput.required = true;
            processNumberInput.required = true;

            logHistoryGroup.classList.add('hidden-field');

        } else {
            document.getElementById('modal-title').textContent = 'Adicionar Novo Processo';
            document.getElementById('modal-submit-btn').textContent = 'Adicionar';
            
            startDateGroup.classList.remove('hidden-field');
            startDateInput.value = new Date().toISOString().split("T")[0];
            startDateInput.required = true;

            logHistoryGroup.classList.add('hidden-field');
        }

        toggleContractFields(document.getElementById('process-status').value);
        document.getElementById('processModal').classList.add('active');
    }

    function openContractDetailsModal(processId) {
        const modal = document.getElementById('contractDetailsModal');
        const form = document.getElementById('contractDetailsForm');
        form.reset();
        document.getElementById('contract-details-process-id').value = processId;
        modal.classList.add('active');
    }

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
    // REPORTS SECTION LOGIC (VERSÃO APRIMORADA)
    // =================================================================================

    // --- Funções Auxiliares para Geração de PDF ---

    /**
     * Desenha o cabeçalho padrão em todas as páginas do PDF.
     * @param {jsPDF} doc A instância do documento jsPDF.
     * @param {object} data Contendo o título do relatório.
     */
    const drawPageHeader = (doc, data) => {
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 15;

        if (logoImage) {
            doc.addImage(logoImage, 'PNG', margin, 10, 22, 22);
        }
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#333333');
        doc.text('Câmara Municipal de Embu-Guaçu', pageW / 2, 20, { align: 'center' });
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#6c757d');
        doc.text(data.title, pageW / 2, 28, { align: 'center' });

        doc.setLineWidth(0.5);
        doc.setDrawColor('#dee2e6');
        doc.line(margin, 38, pageW - margin, 38);
    };

    /**
     * Adiciona números de página e data de geração no rodapé de todas as páginas.
     * @param {jsPDF} doc A instância do documento jsPDF.
     */
    const addPageNumbers = (doc) => {
        const pageCount = doc.internal.getNumberOfPages();
        const pageW = doc.internal.pageSize.getWidth();
        const margin = 15;

        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor('#adb5bd');
            
            const generationDate = `Gerado em: ${new Date().toLocaleString('pt-BR')}`;
            doc.text(generationDate, margin, doc.internal.pageSize.getHeight() - 10);
            
            const pageText = `Página ${i} de ${pageCount}`;
            doc.text(pageText, pageW - margin, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
        }
    };

    /**
     * Desenha um card de KPI (Indicador-Chave de Desempenho) no PDF.
     * @param {jsPDF} doc A instância do documento jsPDF.
     * @param {object} options Opções de configuração do card.
     */
    const drawKpiCard = (doc, { x, y, w, h, title, value, subtitle = '', valueColor = '#212529', icon, iconBgColor = '#e9ecef' }) => {
        doc.setFillColor('#ffffff');
        doc.setDrawColor('#e9ecef');
        doc.roundedRect(x, y, w, h, 3, 3, 'FD');
        
        doc.setFillColor(iconBgColor);
        doc.roundedRect(x + 5, y + h/2 - 10, 20, 20, 3, 3, 'F');
        doc.setFontSize(14);
        doc.setTextColor('#ffffff');
        const iconChar = icon.replace('fa-', '').charAt(0).toUpperCase();
        doc.text(iconChar, x + 5 + 10, y + h/2 + 2, { align: 'center' });

        const textX = x + 30;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#6c757d');
        doc.text(title.toUpperCase(), textX, y + 9);
        
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(valueColor);
        doc.text(String(value), textX, y + 18);
        
        if (subtitle) {
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor('#6c757d');
            doc.text(subtitle, textX, y + 23);
        }
    };

    /**
     * Renderiza um gráfico Chart.js em um canvas oculto e o adiciona ao PDF.
     * @param {jsPDF} doc A instância do documento jsPDF.
     * @param {object} chartConfig A configuração para o Chart.js.
     * @returns {Promise<number>} A posição Y final após adicionar o gráfico.
     */
    const addChartToPdf = async (doc, { y, chartConfig, title }) => {
        const margin = 15;
        const pageW = doc.internal.pageSize.getWidth();
        const chartW = (pageW / 2) - margin - 5;
        const chartH = chartW * 0.75;

        const tempContainer = document.createElement('div');
        tempContainer.style.width = `${chartW * 4}px`;
        tempContainer.style.height = `${chartH * 4}px`;
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        const canvas = document.createElement('canvas');
        tempContainer.appendChild(canvas);
        document.body.appendChild(tempContainer);

        const chart = new Chart(canvas, { ...chartConfig, options: { ...chartConfig.options, animation: false, responsive: true, maintainAspectRatio: true } });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        const imgData = canvas.toDataURL('image/png');
        
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#343a40');
        doc.text(title, margin, y);
        y += 8;

        doc.addImage(imgData, 'PNG', margin, y, chartW, chartH);
        
        chart.destroy();
        document.body.removeChild(tempContainer);

        return y + chartH + 10;
    };


    // --- Funções Principais de Geração de Relatório ---

    /**
     * Gera o Relatório Gerencial Unificado em PDF com KPIs e gráficos.
     * @param {object} filters Filtros selecionados pelo usuário.
     */
    async function generateUnifiedSummaryReport(filters) {
        showToast('Gerando relatório, por favor aguarde...');

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const margin = 15;
        const pageW = doc.internal.pageSize.getWidth();
        let y = 45;

        const performanceData = processesData
            .filter(p => p.fase === 'Contratado' && p.purchasedValue && p.contractDate)
            .map(p => {
                const planItem = p.planId ? planData.find(item => item.id == p.planId) : null;
                const estimatedValue = planItem ? planItem.value : p.value;
                const economy = parseFloat(estimatedValue || 0) - parseFloat(p.purchasedValue || 0);
                return { ...p, estimatedValue, economy };
            }).filter(p => {
                const contractMonth = new Date(p.contractDate + 'T12:00:00').getMonth().toString();
                const monthMatch = !filters.month || filters.month === contractMonth;
                const typeMatch = !filters.type || p.type === filters.type;
                const priorityMatch = !filters.priority || p.priority === filters.priority;
                return monthMatch && typeMatch && priorityMatch;
            });

        const totalSavings = performanceData.reduce((s, p) => (p.economy > 0 ? s + p.economy : s), 0);
        const totalLoss = performanceData.reduce((s, p) => (p.economy < 0 ? s + Math.abs(p.economy) : s), 0);
        const netResult = totalSavings - totalLoss;
        const totalExecutedValue = performanceData.reduce((s, p) => s + parseFloat(p.purchasedValue), 0);

        drawPageHeader(doc, { title: 'Relatório Gerencial de Contratações' });
        
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor('#4361ee');
        doc.text('Resumo Executivo', margin, y);
        y += 10;

        const cardW = (pageW - margin * 2 - 10) / 2;
        const cardH = 30;
        
        drawKpiCard(doc, { x: margin, y, w: cardW, h: cardH, title: 'Resultado Líquido', value: netResult.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}), subtitle: `Economia de ${totalSavings.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})}`, valueColor: netResult >= 0 ? '#2a9d8f' : '#e63946', icon: 'fa-piggy-bank', iconBgColor: netResult >= 0 ? '#2a9d8f' : '#e63946' });
        drawKpiCard(doc, { x: margin + cardW + 10, y, w: cardW, h: cardH, title: 'Valor Total Executado', value: totalExecutedValue.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}), subtitle: `${performanceData.length} processos contratados`, icon: 'fa-check-double', iconBgColor: '#4361ee' });
        y += cardH + 10;

        if (performanceData.length > 0) {
            doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor('#4361ee');
            doc.text('Análise Visual', margin, y);
            y += 10;

            const modalityAnalysis = performanceData.reduce((acc, p) => {
                const mod = p.modality || 'Não Definida';
                acc[mod] = (acc[mod] || 0) + 1;
                return acc;
            }, {});

            const typeAnalysis = performanceData.reduce((acc, p) => {
                const type = p.type || 'Não Definido';
                if (!acc[type]) acc[type] = { totalEstimated: 0, totalExecuted: 0 };
                acc[type].totalEstimated += parseFloat(p.estimatedValue);
                acc[type].totalExecuted += parseFloat(p.purchasedValue);
                return acc;
            }, {});

            const modalityChartConfig = {
                type: 'doughnut',
                data: {
                    labels: Object.keys(modalityAnalysis),
                    datasets: [{
                        data: Object.values(modalityAnalysis),
                        backgroundColor: CHART_COLORS,
                        borderColor: '#ffffff',
                        borderWidth: 2
                    }]
                },
                options: { plugins: { legend: { position: 'right' } } }
            };

            const typeChartConfig = {
                type: 'bar',
                data: {
                    labels: Object.keys(typeAnalysis),
                    datasets: [
                        { label: 'Valor Estimado', data: Object.values(typeAnalysis).map(d => d.totalEstimated), backgroundColor: '#adb5bd' },
                        { label: 'Valor Executado', data: Object.values(typeAnalysis).map(d => d.totalExecuted), backgroundColor: '#4361ee' }
                    ]
                },
                options: { scales: { y: { beginAtZero: true } } }
            };
            
            const chartYStart = y;
            await addChartToPdf(doc, { y: chartYStart, chartConfig: modalityChartConfig, title: 'Contratos por Modalidade' });
            doc.addImage(await getChartImage(typeChartConfig, (pageW / 2) - margin - 5), 'PNG', pageW/2 + 5, chartYStart + 8, (pageW / 2) - margin - 5, ((pageW / 2) - margin - 5) * 0.75);
            doc.text('Estimado vs. Executado por Tipo', pageW/2 + 5, chartYStart);
            y = chartYStart + (((pageW / 2) - margin - 5) * 0.75) + 20;
        }

        doc.addPage();
        y = 45;
        drawPageHeader(doc, { title: 'Relatório Gerencial de Contratações' });
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor('#4361ee');
        doc.text('Detalhamento Financeiro', margin, y);
        y += 10;
        
        doc.autoTable({
            startY: y,
            head: [['Nº Processo', 'Objeto', 'Valor Estimado', 'Valor Final', 'Economia']],
            body: performanceData.map(p => [
                p.processNumber,
                p.object.substring(0, 40) + (p.object.length > 40 ? '...' : ''),
                parseFloat(p.estimatedValue).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}),
                parseFloat(p.purchasedValue).toLocaleString('pt-BR', {style:'currency', currency:'BRL'}),
                p.economy.toLocaleString('pt-BR', {style:'currency', currency:'BRL'})
            ]),
            theme: 'striped',
            headStyles: { fillColor: '#4361ee' },
            didParseCell: function(data) {
                if (data.column.dataKey === 4) {
                    const value = parseFloat(data.cell.raw.toString().replace(/[^0-9,-]+/g,"").replace(',', '.'));
                    if (value > 0) data.cell.styles.textColor = '#2a9d8f';
                    if (value < 0) data.cell.styles.textColor = '#e63946';
                }
            }
        });

        addPageNumbers(doc);
        doc.save(`Relatorio_Gerencial_${new Date().toISOString().slice(0,10)}.pdf`);
        showToast('Relatório gerado com sucesso!');
    }


    /**
     * Gera um PDF detalhado para um processo específico.
     * @param {string} processId O ID do processo.
     */
    async function generateProcessDetailPdf(processId) {
        const process = processesData.find(p => p.id == processId);
        if (!process) return showToast('Erro: Processo não encontrado.');
        
        showToast(`Gerando PDF para o processo Nº ${process.processNumber || 'S/N'}...`);

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const margin = 15;
        const pageW = doc.internal.pageSize.getWidth();
        let y = 45;

        drawPageHeader(doc, { title: `Acompanhamento do Processo Nº: ${process.processNumber || 'S/N'}` });
        
        const planItem = process.planId ? planData.find(item => item.id == process.planId) : null;
        const estimatedValue = planItem ? planItem.value : process.value;
        const economy = (process.purchasedValue && estimatedValue) ? (parseFloat(estimatedValue) - parseFloat(process.purchasedValue)) : null;

        const details = [
            { label: 'Objeto', value: process.object, span: 2 },
            { label: 'Status Atual', value: process.fase },
            { label: 'Localização', value: `${process.location.sector} (${process.location.responsible || '-'})` },
            { label: 'Valor Estimado', value: parseFloat(estimatedValue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) },
            { label: 'Valor Contratado', value: process.purchasedValue ? parseFloat(process.purchasedValue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A' },
            { label: 'Economia', value: economy !== null ? economy.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A' },
            { label: 'Prazo Limite', value: process.deadline ? new Date(process.deadline + 'T00:00:00').toLocaleDateString('pt-BR') : 'N/A' }
        ];
        
        doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor('#343a40');
        doc.text('Informações Gerais', margin, y);
        y += 6;
        doc.setLineWidth(0.2); doc.setDrawColor('#dee2e6');
        doc.line(margin, y, pageW - margin, y);
        y += 8;

        const colWidth = (pageW - margin * 2) / 2;
        let currentX = margin;
        details.forEach(detail => {
            const itemWidth = detail.span ? pageW - margin * 2 : colWidth - 5;
            const textLines = doc.splitTextToSize(String(detail.value), itemWidth);
            
            doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor('#6c757d');
            doc.text(detail.label.toUpperCase(), currentX, y);
            
            doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor('#212529');
            doc.text(textLines, currentX, y + 5);
            
            if (detail.span) {
                y += (textLines.length * 5) + 8;
            } else {
                currentX += colWidth;
                if (currentX >= pageW - margin) {
                    currentX = margin;
                    y += (textLines.length * 5) + 8;
                }
            }
        });
        y += 10;

        const tableConfig = { theme: 'grid', headStyles: { fillColor: '#495057' } };
        
        y = doc.autoTable.previous ? doc.autoTable.previous.finalY + 10 : y;
        if(process.history && process.history.length > 0) {
            doc.autoTable({ startY: y, head: [['Histórico de Fases', 'Início', 'Fim', 'Duração']], body: process.history.map(e => [e.fase, new Date(e.startDate).toLocaleString('pt-BR'), e.endDate ? new Date(e.endDate).toLocaleString('pt-BR') : 'Atual', formatDuration(e.startDate, e.endDate)]), ...tableConfig });
            y = doc.autoTable.previous.finalY;
        }

        y = doc.autoTable.previous ? doc.autoTable.previous.finalY + 10 : y;
        if(process.locationHistory && process.locationHistory.length > 0) {
            doc.autoTable({ startY: y, head: [['Histórico de Localizações', 'Responsável', 'Início', 'Fim', 'Duração']], body: process.locationHistory.map(e => [e.sector, e.responsible || '-', new Date(e.startDate).toLocaleString('pt-BR'), e.endDate ? new Date(e.endDate).toLocaleString('pt-BR') : 'Atual', formatDuration(e.startDate, e.endDate)]), ...tableConfig });
        }

        addPageNumbers(doc);
        doc.save(`Acompanhamento_Processo_${process.processNumber || process.id}.pdf`);
    }

    function openReportFilterModal(reportType) {
        const modal = document.getElementById('filterReportModal');
        modal.dataset.reportType = reportType;
        modal.classList.add('active');
    }

    document.getElementById('generate-report-with-filters-btn').addEventListener('click', () => {
        const modal = document.getElementById('filterReportModal');
        const reportType = modal.dataset.reportType;
        
        if (reportType === 'unified-summary') {
            const filters = {
                month: document.getElementById('report-filter-month').value,
                type: document.getElementById('report-filter-type').value,
                priority: document.getElementById('report-filter-priority').value,
            };
            generateUnifiedSummaryReport(filters);
        }
        modal.classList.remove('active');
    });

    document.querySelectorAll('[data-action="open-report-modal"]').forEach(button => {
        button.addEventListener('click', () => {
            const reportType = button.dataset.reportType;
            openReportFilterModal(reportType);
        });
    });

    function renderReportsTab() {
        const searchInput = document.getElementById('report-process-search');
        const searchList = document.getElementById('report-process-list');
        
        const sortedProcesses = [...processesData].sort((a, b) => 
            (a.processNumber || "").localeCompare(b.processNumber || "", undefined, { numeric: true })
        );

        const updateList = () => {
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
                filtered.slice(0, 10).forEach(p => {
                    const item = document.createElement('div');
                    item.className = 'searchable-select-item';
                    item.dataset.id = p.id;
                    item.innerHTML = `<strong>Nº ${p.processNumber || 'S/N'}</strong> <small>${p.object}</small>`;
                    item.addEventListener('click', () => {
                        generateProcessDetailPdf(p.id);
                        searchInput.value = `Nº ${p.processNumber || 'S/N'}: ${p.object}`;
                        searchList.classList.remove('active');
                    });
                    searchList.appendChild(item);
                });
                searchList.classList.add('active');
            } else {
                searchList.classList.remove('active');
            }
        };
        
        searchInput.addEventListener('input', updateList);
        searchInput.addEventListener('focus', updateList);
        
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

    async function getChartImage(chartConfig, width) {
        const tempContainer = document.createElement('div');
        tempContainer.style.width = `${width * 4}px`;
        tempContainer.style.height = `${width * 0.75 * 4}px`;
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        const canvas = document.createElement('canvas');
        tempContainer.appendChild(canvas);
        document.body.appendChild(tempContainer);
        
        const chart = new Chart(canvas, { ...chartConfig, options: { ...chartConfig.options, animation: false, responsive: true, maintainAspectRatio: true } });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        const imgData = canvas.toDataURL('image/png');
        
        chart.destroy();
        document.body.removeChild(tempContainer);
        return imgData;
    }

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
