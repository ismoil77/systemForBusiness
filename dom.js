// dom.js — безопасная и понятная работа с интерфейсом

// === ИМПОРТЫ ===
import { deleteData, getData, logActivity, postData, putData } from './api.js';
let fullClientList = [];

// Текущий отображаемый список (может быть отфильтрован)
let currentClientList = [];
// === УПРАВЛЕНИЕ ЗАГРУЗКОЙ ===
const loadingOverlay = document.getElementById('loading-overlay');

/**
 * Показать оверлей загрузки
 */
function showLoading() {
	loadingOverlay.style.display = 'flex';
	// Блокируем прокрутку (опционально)
	document.body.style.overflow = 'hidden';
}

/**
 * Скрыть оверлей загрузки
 */
function hideLoading() {
	loadingOverlay.style.display = 'none';
	document.body.style.overflow = ''; // восстанавливаем прокрутку
}
// === КЭШИРОВАНИЕ DOM-ЭЛЕМЕНТОВ ===
const offlineWarning = document.getElementById('offline-warning');
const allButtons = document.querySelectorAll('button');
const box = document.querySelector('.box');
const searchClient = document.querySelector('.searchClient');
const addBtnClient = document.querySelector('.addBtnClient');
const editClientDialog = document.querySelector('.editClientDialog');
const dialogInfo = document.querySelector('.dialogInfo');
const addDialog = document.querySelector('.addDialog');
const editClientForm = document.querySelector('.editClientForm');
const formAdd = document.querySelector('.formAdd');
const placeInfo = document.querySelector('.placeInfo');
const clientInfo = document.querySelector('.clientInfo');
const creditInfo = document.querySelector('.creditInfo');
const pulInfo = document.querySelector('.pulInfo');
const qarzNimaInfo = document.querySelector('.qarzNimaInfo');
const qarzNechiInfo = document.querySelector('.qarzNechiInfo');
const qarzNarkhInfo = document.querySelector('.qarzNarkhInfo');
const minusInfo = document.querySelector('.minusInfo');
const sposobInfo = document.querySelector('.sposobInfo');
const plusBtnInfo = document.querySelector('.plusBtnInfo');
const minusBtnInfo = document.querySelector('.minusBtnInfo');
const dialogInfoClose = document.querySelector('.dialogInfoClose');
const addDialogClose = document.querySelector('.addDialogClose');
const editClientDialogClose = document.querySelector('.editClientDialogClose');
const spisatDolgDate = document.querySelector('.spisatDolgDate');
const addDolgDate = document.querySelector('.addDolgDate');
const dataToday = document.querySelector('.dataToday');
const dataToday22 = document.querySelector('.dataToday22');

// === УСТАНОВКА ТЕКУЩЕЙ ДАТЫ ===
const todayISO = new Date().toISOString().split('T')[0];
spisatDolgDate.value = todayISO;
addDolgDate.value = todayISO;

dataToday.textContent = `Дата: ${new Date().toLocaleDateString('ru-RU', {
	year: 'numeric',
	month: 'long',
	day: 'numeric'
})}`;
dataToday22.innerHTML = dataToday.innerHTML;

// === OFFLINE/ONLINE ОБРАБОТКА ===
function blockActions() {
	offlineWarning.style.display = 'block';
	allButtons.forEach(btn => btn.disabled = true);
	dialogInfo.close();
	editClientDialog.close();
	addDialog.close();
}

function unblockActions() {
	offlineWarning.style.display = 'none';
	allButtons.forEach(btn => btn.disabled = false);
}

window.addEventListener('load', () => {
	if (!navigator.onLine) {
		blockActions();
	} else {
		unblockActions();
		getData();
	}
});

window.addEventListener('online', () => {
	unblockActions();
	getData();
});

window.addEventListener('offline', () => {
	blockActions();
});

// === ЗАКРЫТИЕ ДИАЛОГОВ ===
editClientDialogClose.addEventListener('click', () => {
	editClientDialog.close();
	editClientForm.reset();
});

addDialogClose.addEventListener('click', () => {
	addDialog.close();
	formAdd.reset();
});

dialogInfoClose.addEventListener('click', () => {
	dialogInfo.close();
	resetDebtPaymentFields();
});

// Сброс полей долга/выплаты
function resetDebtPaymentFields() {
	qarzNimaInfo.value = '';
	qarzNechiInfo.value = '';
	qarzNarkhInfo.value = '';
	minusInfo.value = '';
	sposobInfo.value = '';
}

// === ПОИСК ===
// СТАЛО: локальный синхронный поиск
searchClient.addEventListener('input', () => {
	const searchTerm = searchClient.value.trim().toLowerCase();

	if (searchTerm === '') {
		// Возвращаем ПОЛНЫЙ список
		renderClientTable(fullClientList);
	} else {
		// Фильтруем ПОЛНЫЙ список
		const filtered = fullClientList.filter(client =>
			client.client.toLowerCase().includes(searchTerm)
		);
		renderClientTable(filtered);
	}
});
// === ОТКРЫТИЕ ФОРМ ===
addBtnClient.addEventListener('click', () => {
	if (navigator.onLine) addDialog.showModal();
});

// === ДОБАВЛЕНИЕ КЛИЕНТА ===
formAdd.addEventListener('submit', async (e) => {
	e.preventDefault();
	if (!navigator.onLine) return;

	const clientName = formAdd.client.value.trim();
	const place = formAdd.place.value;
	const phone = formAdd.phoneNumber.value.trim();

	if (!clientName || !place || !phone) {
		alert('Заполните все поля');
		return;
	}

	showLoading(); // ← ПОКАЗАТЬ ЗАГРУЗКУ

	try {
		const newUser = {
			client: clientName,
			credit: 0,
			place: place,
			phoneNumber: [phone],
			viruchka: [],
			creditHistory: []
		};

		await logActivity(`Добавил нового клиента: "${clientName}", телефон: ${phone}, место: ${place}`);
		await postData(newUser);
		formAdd.reset();
		addDialog.close();
	} catch (err) {
		console.error('Ошибка при добавлении клиента:', err);
		alert('Не удалось добавить клиента');
	} finally {
		hideLoading(); // ← СКРЫТЬ В ЛЮБОМ СЛУЧАЕ
	}
});

// === ГЛАВНАЯ ФУНКЦИЯ ОТРИСОВКИ ТАБЛИЦЫ ===
export function getDataToTable(data) {
	// Сохраняем ПОЛНЫЙ список
	fullClientList = [...data];
	// Отображаем полный список
	renderClientTable(data);
}
export function renderClientTable(data) {
	box.innerHTML = '';
	currentClientList = [...data];

	data.forEach((client, index) => {
		const tr = document.createElement('tr');

		// №
		const tdId = document.createElement('td');
		tdId.textContent = index + 1;

		// Клиент + телефон
		const tdClient = document.createElement('td');
		const phone = client.phoneNumber?.[0] || 'нет';
		tdClient.textContent = `${client.client} (${phone})`;

		// Долг
		const tdCredit = document.createElement('td');
		tdCredit.textContent = `${client.credit || 0} сомони`;

		// Место
		const tdPlace = document.createElement('td');
		tdPlace.textContent = client.place || '';

		// Действия
		const tdActions = document.createElement('td');
tdActions.classList.add('no-print'); // ← ЭТА СТРОКА
		// === КНОПКА "ИНФОРМАЦИЯ" ===
		const btnInfo = document.createElement('button');
		btnInfo.textContent = 'Информация';
		btnInfo.classList.add('btn', 'info-btn');
		btnInfo.addEventListener('click', () => openClientInfo(client));

		// === КНОПКА "УДАЛИТЬ" ===
		const btnDelete = document.createElement('button');
		btnDelete.textContent = 'Удалить';
		btnDelete.classList.add('btn', 'delete-btn');
	btnDelete.addEventListener('click', () => {
	if (!navigator.onLine) {
		alert('Нет интернета');
		return;
	}
	if (confirm(`Удалить клиента "${client.client}"?`)) {
		showLoading(); // ← ПОКАЗАТЬ
		const phone = client.phoneNumber?.[0] || '';
		deleteData(client.id, client.client, phone)
			.catch(() => alert('Ошибка удаления'))
			.finally(() => hideLoading()); // ← СКРЫТЬ
	}
});

		// === КНОПКА "РЕДАКТИРОВАТЬ" ===
		const btnEdit = document.createElement('button');
		btnEdit.textContent = 'Редактировать';
		btnEdit.classList.add('btn', 'edit-btn');
		btnEdit.addEventListener('click', () => openEditDialog(client));
btnInfo.classList.add('btn', 'info-btn', 'no-print');
btnDelete.classList.add('btn', 'delete-btn', 'no-print');
btnEdit.classList.add('btn', 'edit-btn', 'no-print');
		tdActions.append(btnInfo, btnDelete, btnEdit);
		tr.append(tdId, tdClient, tdCredit, tdPlace, tdActions);
		box.appendChild(tr);
	});
}

// === ОТКРЫТЬ ДИАЛОГ ИНФОРМАЦИИ О КЛИЕНТЕ ===
function openClientInfo(client) {
	if (!navigator.onLine) return;

	// Сохраняем ссылку на клиента (для обновления)
	let currentClient = { ...client }; // копия

	clientInfo.textContent = `Клиент: ${currentClient.client}`;
	placeInfo.textContent = `Место: ${currentClient.place}`;
	creditInfo.innerHTML = `Долг: ${currentClient.credit || 0} сомони<br>`;

	// === ИСТОРИЯ ДОЛГОВ ===
	renderDebtHistory(currentClient);
	// === ИСТОРИЯ ВЫПЛАТ ===
	renderPaymentHistory(currentClient);

	dialogInfo.showModal();

	// === ОБРАБОТЧИКИ ДОЛГА/ВЫПЛАТЫ (ТОЛЬКО ОДИН РАЗ!) ===
	plusBtnInfo.replaceWith(plusBtnInfo.cloneNode(true)); // убираем старые слушатели
	minusBtnInfo.replaceWith(minusBtnInfo.cloneNode(true));
	dialogInfoClose.replaceWith(dialogInfoClose.cloneNode(true));

	// Новые слушатели
	dialogInfo.querySelector('.plusBtnInfo').addEventListener('click', () => addDebt(currentClient));
	dialogInfo.querySelector('.minusBtnInfo').addEventListener('click', () => addPayment(currentClient));
	dialogInfo.querySelector('.dialogInfoClose').addEventListener('click', () => {
		dialogInfo.close();
		resetDebtPaymentFields();
	});
}

// === ОТРИСОВКА ИСТОРИИ ДОЛГОВ ===
function renderDebtHistory(client) {
	let table = '<table><tr><th>№</th><th>Дата</th><th>Сумма</th><th>Что купил</th><th>Действия</th></tr>';
	(client.creditHistory || []).forEach((item, idx) => {
		table += `
			<tr>
				<td>${idx + 1}</td>
				<td>${item[0]}</td>
				<td>${item[1]}</td>
				<td>${item[2]}</td>
				<td><button class="delete-debt btn" data-id="${idx}">Удалить</button></td>
			</tr>`;
	});
	table += '</table>';
	creditInfo.innerHTML += table;

	// Безопасное удаление: используем data-id = индекс в массиве
	creditInfo.querySelectorAll('.delete-debt').forEach(btn => {
		btn.addEventListener('click', async () => {
	const idx = parseInt(btn.dataset.id);
	const history = client.creditHistory || [];
	if (idx < 0 || idx >= history.length) return;

	if (!confirm('Удалить запись о долге?')) return;

	showLoading(); // ← ПОКАЗАТЬ ЗАГРУЗКУ

	try {
		const removed = history.splice(idx, 1)[0];
		const amount = parseFloat(removed[1]) || 0;
		const newCredit = Math.max(0, (parseFloat(client.credit) || 0) - amount);

		await logActivity(
			`Удалил запись долга: "${removed[0]}, ${removed[1]}, ${removed[2]}" у клиента "${client.client}"`
		);

		await putData(client.id, {
			...client,
			credit: newCredit,
			creditHistory: history
		});

		dialogInfo.close();
	} catch (err) {
		alert('Ошибка при удалении записи долга');
	} finally {
		hideLoading(); // ← СКРЫТЬ В ЛЮБОМ СЛУЧАЕ
	}
});
	});
}

// === ОТРИСОВКА ИСТОРИИ ВЫПЛАТ ===
function renderPaymentHistory(client) {
	let table = '<table><tr><th>№</th><th>Дата</th><th>Сумма</th><th>Способ</th><th>Действия</th></tr>';
	(client.viruchka || []).forEach((item, idx) => {
		table += `
			<tr>
				<td>${idx + 1}</td>
				<td>${item[0]}</td>
				<td>${item[1]}</td>
				<td>${item[2]}</td>
				<td><button class="delete-payment btn" data-id="${idx}">Удалить</button></td>
			</tr>`;
	});
	table += '</table>';
	pulInfo.innerHTML = table;

	pulInfo.querySelectorAll('.delete-payment').forEach(btn => {
	btn.addEventListener('click', async () => {
	const idx = parseInt(btn.dataset.id);
	const payments = client.viruchka || [];
	if (idx < 0 || idx >= payments.length) return;

	if (!confirm('Удалить запись о выплате?')) return;

	showLoading(); // ← ПОКАЗАТЬ ЗАГРУЗКУ

	try {
		const removed = payments.splice(idx, 1)[0];
		const amount = parseFloat(removed[1]) || 0;
		const newCredit = (parseFloat(client.credit) || 0) + amount;

		await logActivity(
			`Удалил выплату: "${removed[0]}, ${removed[1]}, ${removed[2]}" у клиента "${client.client}"`
		);

		await putData(client.id, {
			...client,
			credit: newCredit,
			viruchka: payments
		});

		dialogInfo.close();
	} catch (err) {
		alert('Ошибка при удалении записи выплаты');
	} finally {
		hideLoading(); // ← СКРЫТЬ
	}
});
	});
}

// === ДОБАВИТЬ ДОЛГ ===
async function addDebt(client) {
	const what = qarzNimaInfo.value.trim();
	const qty = parseFloat(qarzNechiInfo.value);
	const price = parseFloat(qarzNarkhInfo.value);
	const date = addDolgDate.value || todayISO;

	if (!what || isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
		alert('Заполните все поля корректно (количество и цена > 0)');
		return;
	}

	showLoading(); // ← ПОКАЗАТЬ

	try {
		const total = qty * price;
		const description = `${what} ${qty}шт×${price} сомони`;

		const newHistory = [...(client.creditHistory || []), [date, `${total} сомони`, description]];
		const newCredit = (parseFloat(client.credit) || 0) + total;

		await putData(client.id, {
			...client,
			credit: newCredit,
			creditHistory: newHistory
		});

		await logActivity(`Добавил долг ${total} сомони клиенту "${client.client}" за "${description}"`);
		dialogInfo.close();
	} catch (err) {
		alert('Ошибка при добавлении долга');
	} finally {
		hideLoading(); // ← СКРЫТЬ
	}
}

// === ДОБАВИТЬ ВЫПЛАТУ ===
async function addPayment(client) {
	const amount = parseFloat(minusInfo.value);
	const method = sposobInfo.value.trim();
	const date = spisatDolgDate.value || todayISO;

	if (isNaN(amount) || amount <= 0 || !method) {
		alert('Укажите сумму (>0) и способ оплаты');
		return;
	}

	const currentDebt = parseFloat(client.credit) || 0;
	if (amount > currentDebt) {
		alert('Сумма выплаты не может превышать долг!');
		return;
	}

	showLoading(); // ← ДОБАВЬ ЭТО

	try {
		const newPayments = [...(client.viruchka || []), [date, `${amount} сомони`, method]];
		const newCredit = currentDebt - amount;

		await putData(client.id, {
			...client,
			credit: newCredit,
			viruchka: newPayments
		});

		await logActivity(
			`Списал ${amount} сомони от "${client.client}" (${method})`
		);
		dialogInfo.close();
	} catch (err) {
		alert('Ошибка при списании выручки');
	} finally {
		hideLoading(); // ← И ЭТО
	}
}

// === ОТКРЫТЬ ДИАЛОГ РЕДАКТИРОВАНИЯ ===
function openEditDialog(client) {
	if (!navigator.onLine) return;

	editClientDialog.showModal();
	editClientForm.client.value = client.client || '';
	editClientForm.place.value = client.place || '';
	editClientForm.phoneNumber.value = client.phoneNumber?.[0] || '';

	// Заменяем форму, чтобы избежать утечки слушателей
	const oldForm = editClientForm;
	const newForm = oldForm.cloneNode(true);
	oldForm.replaceWith(newForm);

	newForm.addEventListener('submit', async (e) => {
		e.preventDefault();

		const updated = {
			client: newForm.client.value.trim(),
			place: newForm.place.value,
			phoneNumber: [newForm.phoneNumber.value.trim()], // ← массив строк!
			credit: client.credit,
			viruchka: client.viruchka || [],
			creditHistory: client.creditHistory || []
		};

// СТАЛО (правильно):


	
	try {
		if (!updated.client || !updated.place || !updated.phoneNumber[0]) {
			alert('Заполните все поля');
			return;
		}
		// ... обновление ...
	await logActivity(
	`Обновил данные клиента "${client.client}" → "${updated.client}", телефон: ${updated.phoneNumber[0]}, место: ${updated.place}`
);
		await putData(client.id, updated);
		await updateInvoicesForClient(client.id, updated.client);
		editClientDialog.close();
	} catch (err) {
		alert('Ошибка при сохранении');
	} finally {
		hideLoading(); // ← СКРЫТЬ
	}
	});
}
// === ЖУРНАЛ ДЕЙСТВИЙ ===
import { getActivityLog } from './api.js';

const openActivityLogBtn = document.getElementById('openActivityLog');
const activityLogDialog = document.getElementById('activityLogDialog');
const closeActivityLogBtn = document.getElementById('closeActivityLog');
const activityLogContent = document.getElementById('activityLogContent');
const customLogDateInput = document.getElementById('customLogDate');

// Открытие журнала
openActivityLogBtn?.addEventListener('click', async () => {
	if (!navigator.onLine) {
		alert('Нет интернета');
		return;
	}
	await loadActivityLog('today');
	activityLogDialog.showModal();
});

// Закрытие
closeActivityLogBtn?.addEventListener('click', () => {
	activityLogDialog.close();
});

// Фильтры
activityLogDialog?.querySelectorAll('[data-date]').forEach(btn => {
	btn.addEventListener('click', async () => {
		const dateType = btn.dataset.date;
		let date = null;

		if (dateType === 'today') {
			date = new Date().toISOString().split('T')[0];
		} else if (dateType === 'yesterday') {
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			date = yesterday.toISOString().split('T')[0];
		}
		// 'all' → date = null

		await loadActivityLog(date);
	});
});

// Кастомная дата
customLogDateInput?.addEventListener('change', async () => {
	await loadActivityLog(customLogDateInput.value);
});

// Загрузка и отображение журнала
// Загрузка и отображение журнала с группировкой по датам
// В dom.js
// Функция для преобразования "16.10.2025" + "14:30" → валидная дата
function parseCustomDateTime(dateStr, timeStr) {
	if (!dateStr || !timeStr) return new Date(); // fallback

	const dateParts = dateStr.split('.');
	if (dateParts.length !== 3) return new Date();

	const [day, month, year] = dateParts;
	// Создаём дату в локальном времени
	const isoStr = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timeStr}:00`;
	return new Date(isoStr);
}

// Обновлённая loadActivityLog
async function loadActivityLog(dateFilter = null) {
	const logs = await getActivityLog();
	let html = '';

	if (logs.length === 0) {
		html = '<p>Нет записей</p>';
	} else {
		// Сортируем от новых к старым
		logs.sort((a, b) => {
			// Берём первую запись для сортировки
			const timeA = a.actions[0]?.time || '00:00';
			const timeB = b.actions[0]?.time || '00:00';
			const dateA = parseCustomDateTime(a.date, timeA);
			const dateB = parseCustomDateTime(b.date, timeB);
			return dateB - dateA;
		});

		html = logs.map(entry => {
			const displayDate = entry.date; // "16.10.2025"
			const actionsHtml = entry.actions.map(act => {
				// Собираем полную дату для отображения
				const fullDate = parseCustomDateTime(entry.date, act.time);
				const timeDisplay = isNaN(fullDate.getTime()) 
					? `${act.time}` 
					: fullDate.toLocaleString('ru-RU');
				
				return `<div class="log-entry"><time>${timeDisplay}</time> — <strong>${act.user}</strong>: ${act.action}</div>`;
			}).join('');
			return `<h3>${displayDate}</h3><div class="log-date-group">${actionsHtml}</div>`;
		}).join('');
	}

	activityLogContent.innerHTML = html;
}
// === ПЕЧАТЬ ТАБЛИЦЫ ===

// === ПЕЧАТЬ БЕЗ КНОПОК ДЕЙСТВИЙ ===
const printBtn = document.querySelector('.print-btn');

printBtn?.addEventListener('click', () => {
	const table = document.getElementById('clients-table');
	if (!table) {
		alert('Таблица не найдена!');
		return;
	}

	// Клонируем таблицу, чтобы не испортить оригинал
	const tableClone = table.cloneNode(true);

	// Удаляем ячейки с классом "no-print" (кнопки действий)
	const noPrintCells = tableClone.querySelectorAll('.no-print');
	noPrintCells.forEach(cell => cell.remove());

	// Формируем HTML для печати
	const printContent = `
		<!DOCTYPE html>
		<html>
		<head>
			<title>Печать списка клиентов</title>
			<style>
				body { 
					font-family: Arial, sans-serif; 
					padding: 20px; 
					font-size: 14px;
				}
				h2 { text-align: center; margin-bottom: 15px; }
				table { 
					width: 100%; 
					border-collapse: collapse; 
					margin-top: 10px; 
				}
				th, td { 
					border: 1px solid #000; 
					padding: 8px; 
					text-align: left; 
				}
				th { 
					background-color: #f2f2f2; 
				}
			</style>
		</head>
		<body>
			<h2>Список клиентов</h2>
			<p><strong>Пользователь:</strong> ${document.querySelector('.odam').value}</p>
			<p><strong>${document.querySelector('.dataToday').textContent}</strong></p>
			${tableClone.outerHTML}
		</body>
		</html>
	`;

	// Печать через iframe
	const iframe = document.createElement('iframe');
	iframe.style.position = 'fixed';
	iframe.style.width = '0';
	iframe.style.height = '0';
	iframe.style.border = 'none';
	document.body.appendChild(iframe);

	const doc = iframe.contentDocument || iframe.contentWindow.document;
	doc.open();
	doc.write(printContent);
	doc.close();

	iframe.contentWindow.focus();
	iframe.contentWindow.print();

	// Удаляем iframe после печати
	setTimeout(() => {
		document.body.removeChild(iframe);
	}, 1000);
});
// === СИСТЕМА НАКЛАДНЫХ ===
const createInvoiceBtn = document.getElementById('createInvoiceBtn');
const invoiceDialog = document.getElementById('invoiceDialog');
const closeInvoiceDialog = document.getElementById('closeInvoiceDialog');
const invoiceClientSelect = document.getElementById('invoiceClient');
const invoiceItemsContainer = document.getElementById('invoiceItems');
const addItemBtn = document.getElementById('addItemBtn');
const saveInvoiceBtn = document.getElementById('saveInvoiceBtn');
const invoicePreview = document.getElementById('invoicePreview');
const previewContent = document.getElementById('previewContent');

// Глобальная переменная с клиентами (берём из fullClientList)
let invoiceClients = [];

// Открытие диалога
createInvoiceBtn?.addEventListener('click', async () => {
	// Обновляем список клиентов
	invoiceClients = [...fullClientList];
	
	// Очищаем выбор
	invoiceClientSelect.innerHTML = '<option value="">Выберите клиента</option>';
	invoiceClients.forEach(client => {
		const option = document.createElement('option');
		option.value = client.id;
		option.textContent = `${client.client} (${client.credit} сомони)`;
		invoiceClientSelect.appendChild(option);
	});

	// Сбрасываем товары
	resetInvoiceItems();
// В обработчике открытия диалога
document.getElementById('invoiceDate').valueAsDate = new Date();
	invoiceDialog.showModal();
});

// Закрытие
closeInvoiceDialog?.addEventListener('click', () => {
	invoiceDialog.close();
});

// Добавление товара
addItemBtn?.addEventListener('click', () => {
	addInvoiceItem();
});

// Сохранение накладной
// Сохранение накладной (группировка по клиенту)
saveInvoiceBtn?.addEventListener('click', async () => {
	const clientId = invoiceClientSelect.value;
	const invoiceDateInput = document.getElementById('invoiceDate');
	const invoiceDate = invoiceDateInput?.value;
	
	if (!clientId) {
		alert('Выберите клиента');
		return;
	}
	if (!invoiceDate) {
		alert('Укажите дату накладной');
		return;
	}

	const items = getInvoiceItems();
	if (items.length === 0) {
		alert('Добавьте хотя бы один товар');
		return;
	}

	const client = invoiceClients.find(c => c.id === clientId);
	if (!client) return;

	showLoading();
	try {
		// Получаем существующие накладные клиента
		const invoiceResponse = await fetch(`https://88e71e2fe0599b7e.mokky.dev/invoice?clientId=${clientId}`);
		let clientInvoices = await invoiceResponse.json();

		// Генерация номера
		const now = new Date();
		const datePart = invoiceDate.replace(/-/g, ''); // Используем выбранную дату!
		const randomPart = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
		const invoiceNumber = `INV-${datePart}-${randomPart}`;

		const newInvoice = {
			invoiceNumber,
			items,
			totalAmount: items.reduce((sum, item) => sum + item.total, 0),
			createdAt: new Date(invoiceDate).toISOString() // ← Дата из формы!
		};

		if (clientInvoices.length > 0) {
			const existing = clientInvoices[0];
			if (!Array.isArray(existing.invoices)) existing.invoices = [];
			
			// Обязательно сохраняем clientName!
			existing.clientName = client.client;
			existing.clientId = client.id;
			existing.invoices.push(newInvoice);

			await fetch(`https://88e71e2fe0599b7e.mokky.dev/invoice/${existing.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(existing)
			});
		} else {
			const newRecord = {
				clientId: client.id,
				clientName: client.client, // ← ОБЯЗАТЕЛЬНО!
				invoices: [newInvoice]
			};
			await fetch('https://88e71e2fe0599b7e.mokky.dev/invoice', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newRecord)
			});
		}

		alert(`Накладная ${invoiceNumber} сохранена!`);
		invoiceDialog.close();
	} catch (err) {
		alert('Ошибка сохранения накладной');
		console.error(err);
	} finally {
		hideLoading();
	}
});

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

function resetInvoiceItems() {
	invoiceItemsContainer.innerHTML = `
		<div class="invoice-item">
			<input type="text" class="item-name" placeholder="Товар" required>
			<input type="number" class="item-qty" placeholder="Кол-во" min="1" value="1" required>
			<input type="number" class="item-price" placeholder="Цена" min="0" step="0.01" required>
			<button type="button" class="btn delete-btn remove-item">Удалить</button>
		</div>
	`;
	addItemEventListeners();
}

function addInvoiceItem() {
	const itemDiv = document.createElement('div');
	itemDiv.className = 'invoice-item';
	itemDiv.innerHTML = `
		<input type="text" class="item-name" placeholder="Товар" required>
		<input type="number" class="item-qty" placeholder="Кол-во" min="1" value="1" required>
		<input type="number" class="item-price" placeholder="Цена" min="0" step="0.01" required>
		<button type="button" class="btn delete-btn remove-item">Удалить</button>
	`;
	invoiceItemsContainer.appendChild(itemDiv);
	addItemEventListeners();
}

function addItemEventListeners() {
	document.querySelectorAll('.remove-item').forEach(btn => {
		btn.onclick = () => btn.closest('.invoice-item').remove();
	});

	// Обновление превью при изменении
	document.querySelectorAll('.item-name, .item-qty, .item-price').forEach(input => {
		input.oninput = updateInvoicePreview;
	});
}

function getInvoiceItems() {
	const items = [];
	document.querySelectorAll('.invoice-item').forEach(itemEl => {
		const name = itemEl.querySelector('.item-name').value.trim();
		const qty = parseFloat(itemEl.querySelector('.item-qty').value) || 0;
		const price = parseFloat(itemEl.querySelector('.item-price').value) || 0;
		
		if (name && qty > 0 && price >= 0) {
			items.push({
				name,
				quantity: qty,
				price,
				total: qty * price
			});
		}
	});
	return items;
}

function updateInvoicePreview() {
	const items = getInvoiceItems();
	if (items.length === 0) {
		invoicePreview.style.display = 'none';
		return;
	}

	let html = '<table style="width:100%; border-collapse: collapse;">';
	html += '<tr><th>Товар</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr>';
	items.forEach(item => {
		html += `<tr>
			<td>${item.name}</td>
			<td>${item.quantity}</td>
			<td>${item.price.toFixed(2)}</td>
			<td>${item.total.toFixed(2)}</td>
		</tr>`;
	});
	const total = items.reduce((sum, item) => sum + item.total, 0);
	html += `<tr><td colspan="3" style="text-align:right;"><strong>Итого:</strong></td><td><strong>${total.toFixed(2)}</strong></td></tr>`;
	html += '</table>';

	previewContent.innerHTML = html;
	invoicePreview.style.display = 'block';
}
// === ПРОСМОТР НАКЛАДНЫХ ===
const viewInvoicesBtn = document.getElementById('viewInvoicesBtn');
const invoicesViewDialog = document.getElementById('invoicesViewDialog');
const closeInvoicesView = document.getElementById('closeInvoicesView');
const invoicesList = document.getElementById('invoicesList');

viewInvoicesBtn?.addEventListener('click', async () => {
	showLoading();
	try {
		const response = await fetch('https://88e71e2fe0599b7e.mokky.dev/invoice');
		const data = await response.json();

		let html = '';
		data.forEach(clientRecord => {
			html += `<h3>${clientRecord.clientName} (ID: ${clientRecord.clientId})</h3>`;
			html += `<div class="client-invoices">`;
			
			// Сортируем накладные по дате (новые сверху)
			const sortedInvoices = [...clientRecord.invoices].sort(
				(a, b) => new Date(b.createdAt) - new Date(a.createdAt)
			);

			sortedInvoices.forEach(inv => {
				const date = new Date(inv.createdAt).toLocaleDateString('ru-RU');
				html += `
					<div class="invoice-item-preview">
						<strong>${inv.invoiceNumber}</strong> от ${date} — ${inv.totalAmount.toFixed(2)} сомони
						<button class="btn info-btn print-invoice-btn" data-invoice='${JSON.stringify(inv).replace(/'/g, "&#39;")}'>🖨 Печать</button>
					</div>
				`;
			});
			html += `</div><hr>`;
		});

		if (data.length === 0) {
			html = '<p>Нет сохранённых накладных</p>';
		}

		invoicesList.innerHTML = html;
		invoicesViewDialog.showModal();

		// Обработчик печати
		document.querySelectorAll('.print-invoice-btn').forEach(btn => {
			btn.addEventListener('click', () => {
				const invoice = JSON.parse(btn.dataset.invoice.replace(/&#39;/g, "'"));
				printInvoice(invoice);
			});
		});
	} catch (err) {
		alert('Ошибка загрузки накладных');
	} finally {
		hideLoading();
	}
});

closeInvoicesView?.addEventListener('click', () => {
	invoicesViewDialog.close();
});

// Функция печати накладной
// Функция печати накладной (красивая версия)
function printInvoice(invoice) {
	// Форматируем дату
	const invoiceDate = new Date(invoice.createdAt);
	
const formattedDate = invoice.createdAt 
	? new Date(invoice.createdAt).toISOString().split('T')[0] 
	: new Date().toISOString().split('T')[0];
	// Генерируем строки таблицы
	const itemsHtml = invoice.items.map(item => `
		<tr>
			<td>${item.name}</td>
			<td>${item.quantity}</td>
			<td>${item.price.toFixed(2)}</td>
			<td class="sum">${item.total.toFixed(2)}</td>
			<td class="actions">✖️</td>
		</tr>
	`).join('');

	const printContent = `
		<!DOCTYPE html>
		<html lang="ru">
		<head>
			<meta charset="UTF-8">
			<title>Накладная ${invoice.invoiceNumber}</title>
			<style>
				* { box-sizing: border-box; }
				body {
					font-family: 'Arial', sans-serif;
					margin: 40px;
					color: #333;
					background: #fdfdfd;
				}
				h1 {
					text-align: center;
					margin-bottom: 10px;
					font-size: 24px;
				}
				.header, .details {
					display: flex;
					justify-content: space-between;
					margin-bottom: 15px;
					flex-wrap: wrap;
				}
				.header div, .details div {
					flex: 1 1 45%;
					margin-bottom: 10px;
				}
				label {
					font-weight: bold;
				}
				input[type="text"], input[type="number"], input[type="date"] {
					width: 100%;
					height: 30px;
					padding: 5px;
					margin-top: 4px;
					border: 1px solid #ccc;
					border-radius: 4px;
					font-weight: 600;
					font-size: medium;
				}
				table {
					width: 100%;
					border-collapse: collapse;
					margin-top: 20px;
				}
				th, td {
					border: 1px solid #888;
					padding: 8px;
					text-align: left;
				}
				th {
					background-color: #f0f0f0;
				}
				.sum {
					text-align: right;
				}
				.total {
					text-align: right;
					font-weight: bold;
					margin-top: 10px;
					font-size: 16px;
				}
				.signature {
					margin-top: 30px;
					display: flex;
					justify-content: space-between;
				}
				.signature div {
					text-align: center;
				}
				.signature span {
					display: block;
					border-top: 1px solid #000;
					width: 200px;
					margin: 5px auto 0;
					padding-top: 5px;
				}
				@media print {
					.actions { display: none !important; }
					input { border: none !important; }
				}
			</style>
		</head>
		<body>
			<h1>Накладная</h1>

			<div class="header">
				<div>
					<label>Номер накладной:</label>
					<input type="text" value="${invoice.invoiceNumber}" readonly>
				</div>
				<div>
					<label>Дата:</label>
					<input type="date" value="${formattedDate}" readonly>
				</div>
			</div>

			<div class="details">
				<div>
					<label>Компания:</label>
					<input type="text" value="M.M.C" readonly>
				</div>
				<div>
					<label>Клиент:</label>
					<input type="text" value="${invoice.clientName || 'Не указан'}" readonly>
				</div>
			</div>

			<table>
				<thead>
					<tr>
						<th>Наименование товара</th>
						<th>Кол-во</th>
						<th>Цена</th>
						<th>Сумма</th>
						<th class="actions">Удалить</th>
					</tr>
				</thead>
				<tbody>
					${itemsHtml}
				</tbody>
			</table>

			<div class="total">
				Общая сумма: <span id="totalSum">${invoice.totalAmount.toFixed(2)}</span> сомони.
			</div>

			<div class="signature">
				<div>
					Подпись клиента: <span></span>
				</div>
				<div>
					Подпись: <span></span>
				</div>
			</div>

			<script>
				// Автоматическая печать через 1 секунду
				setTimeout(() => window.print(), 500);
			</script>
		</body>
		</html>
	`;

	const win = window.open('', '_blank');
	win.document.write(printContent);
	win.document.close();
	win.focus();
}