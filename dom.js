// dom.js — безопасная и понятная работа с интерфейсом

// === ИМПОРТЫ ===
import {
	deleteData,
	getData,
	logActivity,
	postData,
	putData,
	updateInvoicesForClient,
	getZones, addZone, deleteZone, updateZone
} from './api.js'
let fullClientList = []
let allInvoicesMap = new Map() // id → invoice
// Текущий отображаемый список (может быть отфильтрован)
let currentClientList = []
let originalClientRecords = [] // в начало dom.js
// === УПРАВЛЕНИЕ ЗАГРУЗКОЙ ===
const loadingOverlay = document.getElementById('loading-overlay')

/**
 * Показать оверлей загрузки
 */
function showLoading() {
	loadingOverlay.style.display = 'flex'
	// Блокируем прокрутку (опционально)
	document.body.style.overflow = 'hidden'
}

/**
 * Скрыть оверлей загрузки
 */
function hideLoading() {
	loadingOverlay.style.display = 'none'
	document.body.style.overflow = '' // восстанавливаем прокрутку
}
// === КЭШИРОВАНИЕ DOM-ЭЛЕМЕНТОВ ===
const offlineWarning = document.getElementById('offline-warning')
const allButtons = document.querySelectorAll('button')
const box = document.querySelector('.box')
const searchClient = document.querySelector('.searchClient')
const addBtnClient = document.querySelector('.addBtnClient')
const editClientDialog = document.querySelector('.editClientDialog')
const dialogInfo = document.querySelector('.dialogInfo')
const addDialog = document.querySelector('.addDialog')
const editClientForm = document.querySelector('.editClientForm')
const formAdd = document.querySelector('.formAdd')
const placeInfo = document.querySelector('.placeInfo')
const clientInfo = document.querySelector('.clientInfo')
const creditInfo = document.querySelector('.creditInfo')
const pulInfo = document.querySelector('.pulInfo')
const qarzNimaInfo = document.querySelector('.qarzNimaInfo')
const qarzNechiInfo = document.querySelector('.qarzNechiInfo')
const qarzNarkhInfo = document.querySelector('.qarzNarkhInfo')
const minusInfo = document.querySelector('.minusInfo')
const sposobInfo = document.querySelector('.sposobInfo')
const plusBtnInfo = document.querySelector('.plusBtnInfo')
const minusBtnInfo = document.querySelector('.minusBtnInfo')
const dialogInfoClose = document.querySelector('.dialogInfoClose')
// === ИСПРАВЛЕНИЕ МНОЖЕСТВЕННЫХ ЗАПРОСОВ ===
let currentClientId = null // Хранит ID открытого клиента
let isProcessing = false // Флаг: идёт ли сейчас запрос

// Обработчик кнопки "Добавить долг" (подписываемся ОДИН РАЗ)
plusBtnInfo.addEventListener('click', async () => {
	// Если диалог закрыт ИЛИ уже идёт обработка - ничего не делаем
	if (!currentClientId || isProcessing) return

	// Ищем клиента по сохранённому ID
	const client = fullClientList.find(c => c.id === currentClientId)
	if (!client) return

	// БЛОКИРУЕМ КНОПКУ
	isProcessing = true
	plusBtnInfo.disabled = true
	plusBtnInfo.textContent = '⏳ Добавление...'
	plusBtnInfo.style.opacity = '0.6'

	try {
		// Вызываем функцию добавления долга
		await addDebt(client)
		qarzNimaInfo.value = ''
		qarzNechiInfo.value = ''
		qarzNarkhInfo.value = ''
		addDolgDate.value = todayISO
		// Диалог НЕ закрываем - можно добавить ещё долгов
	} catch (error) {
		console.error('Ошибка:', error)
		alert('Не удалось добавить долг')
	} finally {
		// РАЗБЛОКИРУЕМ КНОПКУ (в любом случае)
		isProcessing = false
		plusBtnInfo.disabled = false
		plusBtnInfo.textContent = 'Добавить долг'
		plusBtnInfo.style.opacity = '1'
	}
})

// Обработчик кнопки "Списать" (аналогично)
minusBtnInfo.addEventListener('click', async () => {
	if (!currentClientId || isProcessing) return

	const client = fullClientList.find(c => c.id === currentClientId)
	if (!client) return

	isProcessing = true
	minusBtnInfo.disabled = true
	minusBtnInfo.textContent = '⏳ Списание...'
	minusBtnInfo.style.opacity = '0.6'

	try {
		await addPayment(client)
		resetDebtPaymentFields()
	} catch (error) {
		console.error('Ошибка:', error)
		alert('Не удалось списать выплату')
	} finally {
		isProcessing = false
		minusBtnInfo.disabled = false
		minusBtnInfo.textContent = 'Списать'
		minusBtnInfo.style.opacity = '1'
	}
})
const addDialogClose = document.querySelector('.addDialogClose')
const editClientDialogClose = document.querySelector('.editClientDialogClose')
const spisatDolgDate = document.querySelector('.spisatDolgDate')
const addDolgDate = document.querySelector('.addDolgDate')
const dataToday = document.querySelector('.dataToday')
const dataToday22 = document.querySelector('.dataToday22')

// === УСТАНОВКА ТЕКУЩЕЙ ДАТЫ ===
const todayISO = new Date().toISOString().split('T')[0]
spisatDolgDate.value = todayISO
addDolgDate.value = todayISO

dataToday.textContent = `Дата: ${new Date().toLocaleDateString('ru-RU', {
	year: 'numeric',
	month: 'long',
	day: 'numeric',
})}`
dataToday22.innerHTML = dataToday.innerHTML

// === OFFLINE/ONLINE ОБРАБОТКА ===
function blockActions() {
	offlineWarning.style.display = 'block'
	allButtons.forEach(btn => (btn.disabled = true))
	dialogInfo.close()
	editClientDialog.close()
	addDialog.close()
}

function unblockActions() {
	offlineWarning.style.display = 'none'
	allButtons.forEach(btn => (btn.disabled = false))
}

window.addEventListener('load', () => {
	if (!navigator.onLine) {
		blockActions()
	} else {
		unblockActions()
		getData()
	}
})

window.addEventListener('online', () => {
	unblockActions()
	getData()
})

window.addEventListener('offline', () => {
	blockActions()
})

// === ЗАКРЫТИЕ ДИАЛОГОВ ===
editClientDialogClose.addEventListener('click', () => {
	editClientDialog.close()
	editClientForm.reset()
})

addDialogClose.addEventListener('click', () => {
	addDialog.close()
	formAdd.reset()
})

dialogInfoClose.addEventListener('click', () => {
	currentClientId = null
	dialogInfo.close()
	resetDebtPaymentFields()
})

// Сброс полей долга/выплаты
function resetDebtPaymentFields() {
	qarzNimaInfo.value = ''
	qarzNechiInfo.value = ''
	qarzNarkhInfo.value = ''
	minusInfo.value = ''
	sposobInfo.value = ''
}

// === ПОИСК ===
// СТАЛО: локальный синхронный поиск
searchClient.addEventListener('input', () => {
	const searchTerm = searchClient.value.trim().toLowerCase()

	if (searchTerm === '') {
		// Возвращаем ПОЛНЫЙ список
		renderClientTable(fullClientList)
	} else {
		// Фильтруем ПОЛНЫЙ список
		const filtered = fullClientList.filter(client =>
			client.client.toLowerCase().includes(searchTerm)
		)
		renderClientTable(filtered)
	}
})
// === ОТКРЫТИЕ ФОРМ ===
addBtnClient.addEventListener('click', () => {
	if (navigator.onLine) addDialog.showModal()
})

// === ДОБАВЛЕНИЕ КЛИЕНТА ===
formAdd.addEventListener('submit', async e => {
	e.preventDefault()
	if (!navigator.onLine) return

	const clientName = formAdd.client.value.trim()
	const place = formAdd.place.value
	const phone = formAdd.phoneNumber.value.trim()

	if (!clientName || !place || !phone) {
		alert('Заполните все поля')
		return
	}

	showLoading() // ← ПОКАЗАТЬ ЗАГРУЗКУ

	try {
		const newUser = {
			client: clientName,
			credit: 0,
			place: place,
			phoneNumber: [phone],
			viruchka: [],
			creditHistory: [],
		}

		await logActivity(
			`Добавил нового клиента: "${clientName}", телефон: ${phone}, место: ${place}`
		)
		await postData(newUser)
		formAdd.reset()
		addDialog.close()
	} catch (err) {
		console.error('Ошибка при добавлении клиента:', err)
		alert('Не удалось добавить клиента')
	} finally {
		hideLoading() // ← СКРЫТЬ В ЛЮБОМ СЛУЧАЕ
	}
})

// === ГЛАВНАЯ ФУНКЦИЯ ОТРИСОВКИ ТАБЛИЦЫ ===
export function getDataToTable(data) {
	// Сохраняем ПОЛНЫЙ список
	fullClientList = [...data]
	// Отображаем полный список
	renderClientTable(data)
}
export function renderClientTable(data) {
	box.innerHTML = ''
	currentClientList = [...data]

	data.forEach((client, index) => {
		const tr = document.createElement('tr')

		// №
		const tdId = document.createElement('td')
		tdId.textContent = index + 1

		// Клиент + телефон
		const tdClient = document.createElement('td')
		const phone = client.phoneNumber?.[0] || 'нет'
		tdClient.textContent = `${client.client} (${phone})`

		// Долг
		const tdCredit = document.createElement('td')
		tdCredit.textContent = `${client.credit || 0} сомони`

		// Место
		const tdPlace = document.createElement('td')
		tdPlace.textContent = client.place || ''

		// Действия
		const tdActions = document.createElement('td')
		tdActions.classList.add('no-print') // ← ЭТА СТРОКА
		// === КНОПКА "ИНФОРМАЦИЯ" ===
		const btnInfo = document.createElement('button')
		btnInfo.textContent = 'Информация'
		btnInfo.classList.add('btn', 'info-btn')
		btnInfo.addEventListener('click', () => openClientInfo(client))

		// === КНОПКА "УДАЛИТЬ" ===
		const btnDelete = document.createElement('button')
		btnDelete.textContent = 'Удалить'
		btnDelete.classList.add('btn', 'delete-btn')
		btnDelete.addEventListener('click', () => {
			if (!navigator.onLine) {
				alert('Нет интернета')
				return
			}
			if (confirm(`Удалить клиента "${client.client}"?`)) {
				showLoading() // ← ПОКАЗАТЬ
				const phone = client.phoneNumber?.[0] || ''
				deleteData(client.id, client.client, phone)
					.catch(() => alert('Ошибка удаления'))
					.finally(() => hideLoading()) // ← СКРЫТЬ
			}
		})

		// === КНОПКА "РЕДАКТИРОВАТЬ" ===
		const btnEdit = document.createElement('button')
		btnEdit.textContent = 'Редактировать'
		btnEdit.classList.add('btn', 'edit-btn')
		btnEdit.addEventListener('click', () => openEditDialog(client))
		btnInfo.classList.add('btn', 'info-btn', 'no-print')
		btnDelete.classList.add('btn', 'delete-btn', 'no-print')
		btnEdit.classList.add('btn', 'edit-btn', 'no-print')
		tdActions.append(btnInfo, btnDelete, btnEdit)
		tr.append(tdId, tdClient, tdCredit, tdPlace, tdActions)
		box.appendChild(tr)
	})
}

// === ОТКРЫТЬ ДИАЛОГ ИНФОРМАЦИИ О КЛИЕНТЕ ===
function openClientInfo(client) {
	if (!navigator.onLine) return
	// === КНОПКА ПЕЧАТИ ИСТОРИИ КЛИЕНТА ===
	const printHistoryBtn = dialogInfo.querySelector('.print-client-history-btn')
	if (printHistoryBtn) {
		printHistoryBtn.onclick = () => printClientHistory(client)
	}
	currentClientId = client.id

	clientInfo.textContent = `Клиент: ${client.client}`
	placeInfo.textContent = `Место: ${client.place}`
	creditInfo.innerHTML = `Долг: ${client.credit || 0} сомони<br>`

	renderDebtHistory(client)
	renderPaymentHistory(client)

	dialogInfo.showModal()
}
function sumTransactionHistory(history) {
	if (!Array.isArray(history)) return 0
	return history.reduce((sum, item) => {
		const amountStr = item[1] || '0'
		// Безопасно извлекаем число из строки "1000 сомони"
		// Удаляем все, кроме цифр, точки и минуса
		const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0
		return sum + amount
	}, 0)
}

// === ОТРИСОВКА ИСТОРИИ ДОЛГОВ ===
// ВАЖНО: Добавьте функцию sumTransactionHistory перед этим кодом, если ее нет!

// === ОТРИСОВКА ИСТОРИИ ДОЛГОВ (С ЗАЩИТОЙ И ПЕРЕСЧЕТОМ) ===
// ВАЖНО: Убедитесь, что функции sumTransactionHistory, loadInvoiceModalFromDebt,
// showLoading, hideLoading, logActivity, putData и updateTotalDebt
// определены и доступны в вашем файле dom_js.txt!

// === ОТРИСОВКА ИСТОРИИ ДОЛГОВ (С ЗАЩИТОЙ, ПЕРЕСЧЕТОМ И ЧЕКБОКСАМИ ДЛЯ НАКЛАДНОЙ) ===
function renderDebtHistory(client) {
	// 1. Создание таблицы с новой колонкой для чекбоксов
	let table =
		'<table><tr><th>№</th><th><input type="checkbox" id="selectAllDebts"></th><th>Дата</th><th>Сумма</th><th>Что купил</th><th>Действия</th></tr>'

	// Используем client.creditHistory, который является объектом (массивом)
	;(client.creditHistory || []).forEach((item, idx) => {
		table += `
			<tr>
				<td>${idx + 1}</td>
                <td><input type="checkbox" class="invoice-checkbox" value="${idx}"></td>
				<td>${item[0]}</td>
				<td>${item[1]}</td>
				<td>${item[2]}</td>
				<td><button class="delete-debt btn" data-id="${idx}">Удалить</button></td>
			</tr>`
	})
	table += '</table>'

	// 2. Кнопка для создания накладной
	const invoiceControlsHtml = `
        <div style="margin-bottom: 15px; display: flex; align-items: center; gap: 10px;">
            <button id="loadInvoiceModalBtn" class="btn info-btn">📄 Создать Накладную из выбранного</button>
            <label style="font-size: 14px; color: #555;">(Выберите долги ниже)</label>
        </div>
    `

	creditInfo.innerHTML += invoiceControlsHtml + table // Добавляем элементы в DOM

	// === ОБРАБОТЧИКИ НОВОЙ ФУНКЦИОНАЛЬНОСТИ ===

	// 1. Обработчик "Выбрать все"
	const selectAllCheckbox = creditInfo.querySelector('#selectAllDebts')
	selectAllCheckbox?.addEventListener('change', e => {
		const isChecked = e.target.checked
		creditInfo.querySelectorAll('.invoice-checkbox').forEach(cb => {
			cb.checked = isChecked
		})
	})

	// 2. Обработчик кнопки "Создать Накладную"
	creditInfo
		.querySelector('#loadInvoiceModalBtn')
		?.addEventListener('click', () => {
			// Вызываем функцию, которая собирает данные и открывает модалку накладной
			loadInvoiceModalFromDebt(client)
		})

	// 3. Обработчик УДАЛЕНИЯ ДОЛГА (С ЗАЩИТОЙ И ПЕРЕСЧЕТОМ)
	creditInfo.querySelectorAll('.delete-debt').forEach(btn => {
		btn.addEventListener('click', async () => {
			const idx = parseInt(btn.dataset.id)
			const history = client.creditHistory || []
			if (idx < 0 || idx >= history.length) return

			if (!confirm('Удалить запись о долге?')) return

			// --- 🛡️ ЛОГИКА ЗАЩИТЫ (Проверка Общего Котла) ---
			const amountToDeleteStr = history[idx][1] || '0'
			const amountToDelete =
				parseFloat(amountToDeleteStr.replace(/[^0-9.-]/g, '')) || 0

			// Общая сумма выплат
			const totalPayments = sumTransactionHistory(client.viruchka || [])

			// Общая сумма долгов ДО удаления
			const currentTotalDebts = sumTransactionHistory(history)
			// Общая сумма долгов ПОСЛЕ удаления
			const newTotalDebts = currentTotalDebts - amountToDelete

			// ГЛАВНАЯ ПРОВЕРКА ЦЕЛОСТНОСТИ:
			if (newTotalDebts < totalPayments) {
				alert(
					`🚫 ЗАЩИТА (Несостыковка)! Нельзя удалить этот долг.\n\n` +
						`После удаления: Общая сумма долгов (${newTotalDebts.toFixed(
							0
						)} сомони) будет меньше, чем Общая сумма выплат (${totalPayments.toFixed(
							0
						)} сомони).\n` +
						`Это приведет к отрицательному балансу.\n\n` +
						`Сначала удалите часть выплат, чтобы освободить сумму долга, если это необходимо.`
				)
				return // Блокируем удаление
			}
			// --- КОНЕЦ ЛОГИКИ ЗАЩИТЫ ---

			showLoading()

			try {
				// Удаляем запись
				const removed = history.splice(idx, 1)[0]

				// Полный пересчет баланса
				const newCredit = Math.max(0, newTotalDebts - totalPayments)

				await logActivity(
					`Удалил запись долга: "${removed[0]}, ${removed[1]}, ${removed[2]}" у клиента "${client.client}"`
				)

				// Сохраняем с новым, пересчитанным кредитом
				await putData(client.id, {
					...client,
					credit: newCredit,
					creditHistory: history,
				})

				dialogInfo.close()
				updateTotalDebt()
			} catch (err) {
				alert('Ошибка при удалении записи долга')
			} finally {
				hideLoading()
			}
		})
	})
}

// === ОТРИСОВКА ИСТОРИИ ВЫПЛАТ ===
function renderPaymentHistory(client) {
	let table =
		'<table><tr><th>№</th><th>Дата</th><th>Сумма</th><th>Способ</th><th>Действия</th></tr>'
	;(client.viruchka || []).forEach((item, idx) => {
		table += `
			<tr>
				<td>${idx + 1}</td>
				<td>${item[0]}</td>
				<td>${item[1]}</td>
				<td>${item[2]}</td>
				<td><button class="delete-payment btn" data-id="${idx}">Удалить</button></td>
			</tr>`
	})
	table += '</table>'
	pulInfo.innerHTML = table

	pulInfo.querySelectorAll('.delete-payment').forEach(btn => {
		btn.addEventListener('click', async () => {
			const idx = parseInt(btn.dataset.id)
			const payments = client.viruchka || []
			if (idx < 0 || idx >= payments.length) return

			if (!confirm('Удалить запись о выплате?')) return

			showLoading() // ← ПОКАЗАТЬ ЗАГРУЗКУ

			try {
				const removed = payments.splice(idx, 1)[0]
				const amount = parseFloat(removed[1]) || 0
				const newCredit = (parseFloat(client.credit) || 0) + amount

				await logActivity(
					`Удалил выплату: "${removed[0]}, ${removed[1]}, ${removed[2]}" у клиента "${client.client}"`
				)

				await putData(client.id, {
					...client,
					credit: newCredit,
					viruchka: payments,
				})

				dialogInfo.close()
				updateTotalDebt() // ← ДОБАВЬТЕ ЭТУ СТРОКУ
			} catch (err) {
				alert('Ошибка при удалении записи выплаты')
			} finally {
				hideLoading() // ← СКРЫТЬ
			}
		})
	})
}

// === ДОБАВИТЬ ДОЛГ ===
async function addDebt(client) {
	const what = qarzNimaInfo.value.trim()
	const qty = parseFloat(qarzNechiInfo.value)
	const price = parseFloat(qarzNarkhInfo.value)
	const date = addDolgDate.value || todayISO

	if (!what || isNaN(qty) || qty <= 0 || isNaN(price) || price <= 0) {
		alert('Заполните все поля корректно (количество и цена > 0)')
		return
	}

	showLoading() // ← ПОКАЗАТЬ

	try {
		const total = qty * price
		const description = `${what} ${qty}шт×${price} сомони`

		const newHistory = [
			...(client.creditHistory || []),
			[date, `${total} сомони`, description],
		]
		const newCredit = (parseFloat(client.credit) || 0) + total

		await putData(client.id, {
			...client,
			credit: newCredit,
			creditHistory: newHistory,
		})

		await logActivity(
			`Добавил долг ${total} сомони клиенту "${client.client}" за "${description}"`
		)
		dialogInfo.close()
		updateTotalDebt() // ← ДОБАВЬТЕ ЭТУ СТРОКУ
	} catch (err) {
		alert('Ошибка при добавлении долга')
	} finally {
		hideLoading() // ← СКРЫТЬ
	}
}

// === ДОБАВИТЬ ВЫПЛАТУ ===
async function addPayment(client) {
	const amount = parseFloat(minusInfo.value)
	const method = sposobInfo.value.trim()
	const date = spisatDolgDate.value || todayISO

	if (isNaN(amount) || amount <= 0 || !method) {
		alert('Укажите сумму (>0) и способ оплаты!!')
		return
	}

	const currentDebt = parseFloat(client.credit) || 0
	if (amount > currentDebt) {
		alert('Сумма выплаты не может превышать долг!')
		return
	}

	showLoading() // ← ДОБАВЬ ЭТО

	try {
		const newPayments = [
			...(client.viruchka || []),
			[date, `${amount} сомони`, method],
		]
		const newCredit = currentDebt - amount

		await putData(client.id, {
			...client,
			credit: newCredit,
			viruchka: newPayments,
		})

		await logActivity(
			`Списал ${amount} сомони от "${client.client}" (${method})`
		)
		dialogInfo.close()
	} catch (err) {
		alert('Ошибка при списании выручки')
	} finally {
		hideLoading() // ← И ЭТО
	}
}

// === ОТКРЫТЬ ДИАЛОГ РЕДАКТИРОВАНИЯ ===
function openEditDialog(client) {
	if (!navigator.onLine) return

	// Удаляем старый обработчик (если был)
	const existingForm = editClientDialog.querySelector('.editClientForm')
	if (existingForm) {
		existingForm.removeEventListener('submit', existingForm._submitHandler)
	}

	// Заполняем существующую форму
	editClientForm.client.value = client.client || ''
	editClientForm.place.value = client.place || ''
	editClientForm.phoneNumber.value = client.phoneNumber?.[0] || ''

	editClientDialog.showModal()

	// Создаём новый обработчик
	const handleSubmit = async e => {
		e.preventDefault()
		const updated = {
			client: editClientForm.client.value.trim(),
			place: editClientForm.place.value,
			phoneNumber: [editClientForm.phoneNumber.value.trim()],
			credit: client.credit,
			viruchka: client.viruchka || [],
			creditHistory: client.creditHistory || [],
		}

		if (!updated.client || !updated.place || !updated.phoneNumber[0]) {
			alert('Заполните все поля')
			return
		}

		showLoading()
		try {
			await logActivity(
				`Обновил данные клиента "${client.client}" → "${updated.client}", телефон: ${updated.phoneNumber[0]}, место: ${updated.place}`
			)
			const numericId = Number(client.id)
			if (isNaN(numericId)) {
				alert('Некорректный ID клиента')
				return
			}
			await putData(numericId, updated)
			await updateInvoicesForClient(numericId, updated.client)
			editClientDialog.close()
			updateTotalDebt() // ← ДОБАВЬТЕ ЭТУ СТРОКУ
		} catch (err) {
			alert('Ошибка при сохранении')
		} finally {
			hideLoading()
		}
	}

	// Сохраняем ссылку на обработчик для будущего удаления
	editClientForm._submitHandler = handleSubmit
	editClientForm.addEventListener('submit', handleSubmit)
}
// === ЖУРНАЛ ДЕЙСТВИЙ ===
import { getActivityLog } from './api.js'

const openActivityLogBtn = document.getElementById('openActivityLog')
const activityLogDialog = document.getElementById('activityLogDialog')
const closeActivityLogBtn = document.getElementById('closeActivityLog')
const activityLogContent = document.getElementById('activityLogContent')
const customLogDateInput = document.getElementById('customLogDate')

// Открытие журнала
openActivityLogBtn?.addEventListener('click', async () => {
	if (!navigator.onLine) {
		alert('Нет интернета')
		return
	}
	await loadActivityLog('today')
	activityLogDialog.showModal()
})

// Закрытие
closeActivityLogBtn?.addEventListener('click', () => {
	activityLogDialog.close()
})

// Фильтры
activityLogDialog?.querySelectorAll('[data-date]').forEach(btn => {
	btn.addEventListener('click', async () => {
		const dateType = btn.dataset.date
		let date = null

		if (dateType === 'today') {
			date = new Date().toISOString().split('T')[0]
		} else if (dateType === 'yesterday') {
			const yesterday = new Date()
			yesterday.setDate(yesterday.getDate() - 1)
			date = yesterday.toISOString().split('T')[0]
		}
		// 'all' → date = null

		await loadActivityLog(date)
	})
})

// Кастомная дата
customLogDateInput?.addEventListener('change', async () => {
	await loadActivityLog(customLogDateInput.value)
})

// Загрузка и отображение журнала
// Загрузка и отображение журнала с группировкой по датам
// В dom.js
// Функция для преобразования "16.10.2025" + "14:30" → валидная дата
function parseCustomDateTime(dateStr, timeStr) {
	if (!dateStr || !timeStr) return new Date() // fallback

	const dateParts = dateStr.split('.')
	if (dateParts.length !== 3) return new Date()

	const [day, month, year] = dateParts
	// Создаём дату в локальном времени
	const isoStr = `${year}-${month.padStart(2, '0')}-${day.padStart(
		2,
		'0'
	)}T${timeStr}:00`
	return new Date(isoStr)
}

// Обновлённая loadActivityLog
async function loadActivityLog(dateFilter = null) {
	const logs = await getActivityLog()
	let html = ''

	if (logs.length === 0) {
		html = '<p>Нет записей</p>'
	} else {
		// Сортируем от новых к старым
		logs.sort((a, b) => {
			// Берём первую запись для сортировки
			const timeA = a.actions[0]?.time || '00:00'
			const timeB = b.actions[0]?.time || '00:00'
			const dateA = parseCustomDateTime(a.date, timeA)
			const dateB = parseCustomDateTime(b.date, timeB)
			return dateB - dateA
		})

		html = logs
			.map(entry => {
				const displayDate = entry.date // "16.10.2025"
				const actionsHtml = entry.actions
					.map(act => {
						// Собираем полную дату для отображения
						const fullDate = parseCustomDateTime(entry.date, act.time)
						const timeDisplay = isNaN(fullDate.getTime())
							? `${act.time}`
							: fullDate.toLocaleString('ru-RU')

						return `<div class="log-entry"><time>${timeDisplay}</time> — <strong>${act.user}</strong>: ${act.action}</div>`
					})
					.join('')
				return `<h3>${displayDate}</h3><div class="log-date-group">${actionsHtml}</div>`
			})
			.join('')
	}

	activityLogContent.innerHTML = html
}
// === ПЕЧАТЬ ТАБЛИЦЫ ===

// === ПЕЧАТЬ БЕЗ КНОПОК ДЕЙСТВИЙ ===
const printBtn = document.querySelector('.print-btn')

printBtn?.addEventListener('click', () => {
	const table = document.getElementById('clients-table')
	if (!table) {
		alert('Таблица не найдена!')
		return
	}

	// Клонируем таблицу, чтобы не испортить оригинал
	const tableClone = table.cloneNode(true)

	// Удаляем ячейки с классом "no-print" (кнопки действий)
	const noPrintCells = tableClone.querySelectorAll('.no-print')
	noPrintCells.forEach(cell => cell.remove())

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
	`

	// Печать через iframe
	const iframe = document.createElement('iframe')
	iframe.style.position = 'fixed'
	iframe.style.width = '0'
	iframe.style.height = '0'
	iframe.style.border = 'none'
	document.body.appendChild(iframe)

	const doc = iframe.contentDocument || iframe.contentWindow.document
	doc.open()
	doc.write(printContent)
	doc.close()

	iframe.contentWindow.focus()
	iframe.contentWindow.print()

	// Удаляем iframe после печати
	setTimeout(() => {
		document.body.removeChild(iframe)
	}, 1000)
})
// === СИСТЕМА НАКЛАДНЫХ ===
const createInvoiceBtn = document.getElementById('createInvoiceBtn')
const invoiceDialog = document.getElementById('invoiceDialog')
const closeInvoiceDialog = document.getElementById('closeInvoiceDialog')
const invoiceClientSelect = document.getElementById('invoiceClient')
const invoiceItemsContainer = document.getElementById('invoiceItems')
const addItemBtn = document.getElementById('addItemBtn')
const saveInvoiceBtn = document.getElementById('saveInvoiceBtn')
const invoicePreview = document.getElementById('invoicePreview')
const previewContent = document.getElementById('previewContent')

// Глобальная переменная с клиентами (берём из fullClientList)
let invoiceClients = []

// Открытие диалога
createInvoiceBtn?.addEventListener('click', async () => {
	// Обновляем список клиентов
	invoiceClients = [...fullClientList]

	// Очищаем выбор
	invoiceClientSelect.innerHTML = '<option value="">Выберите клиента</option>'
	invoiceClients.forEach(client => {
		const option = document.createElement('option')
		option.value = client.id
		option.textContent = `${client.client} (${client.credit} сомони)`
		invoiceClientSelect.appendChild(option)
	})

	// Сбрасываем товары
	resetInvoiceItems()
	// В обработчике открытия диалога
	document.getElementById('invoiceDate').valueAsDate = new Date()
	invoiceDialog.showModal()
})

// Закрытие
closeInvoiceDialog?.addEventListener('click', () => {
	// Разблокировать поле клиента и очистить динамически добавленные опции
	if (invoiceClientSelect) {
		invoiceClientSelect.disabled = false
		// Восстанавливаем только опцию "Выберите клиента" (предполагаем, что она первая)
		invoiceClientSelect.innerHTML =
			invoiceClientSelect.options[0]?.outerHTML ||
			'<option value="">Выберите клиента</option>'
	}
	// Закрыть модалку
	invoiceDialog.close()
})

// Добавление товара
addItemBtn?.addEventListener('click', () => {
	addInvoiceItem()
})

// Сохранение накладной
// Сохранение накладной (группировка по клиенту)
saveInvoiceBtn?.addEventListener('click', async () => {
	const clientId = Number(invoiceClientSelect.value)
	if (isNaN(clientId)) {
		alert('Выберите клиента')
		return
	}
	const invoiceDateInput = document.getElementById('invoiceDate')
	// ... остальной код без изменений
	const invoiceDate = invoiceDateInput?.value

	if (!clientId) {
		alert('Выберите клиента')
		return
	}
	if (!invoiceDate) {
		alert('Укажите дату накладной')
		return
	}

	const items = getInvoiceItems()
	if (items.length === 0) {
		alert('Добавьте хотя бы один товар')
		return
	}

	const client = invoiceClients.find(c => c.id === clientId)
	if (!client) return

	showLoading()
	try {
		// Генерация номера и ID накладной
		const now = Date.now()
		const datePart = invoiceDate.replace(/-/g, '')
		const randomPart = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
		const invoiceNumber = `INV-${datePart}-${randomPart}`

		const newInvoice = {
			id: `inv_${now}`, // уникальный ID
			invoiceNumber,
			items,
			totalAmount: items.reduce((sum, item) => sum + item.total, 0),
			createdAt: new Date(invoiceDate).toISOString(),
		}

		// 1. Получаем существующие накладные клиента
		const response = await fetch(
			`https://7cf074eeac80e141.mokky.dev/invoice?clientId=${clientId}`
		)
		const clientInvoices = await response.json()

		if (clientInvoices.length > 0) {
			// 2. Обновляем существующую запись
			const existing = clientInvoices[0]
			existing.invoices.push(newInvoice)
			existing.clientName = client.client // обновляем имя на случай изменения

			await fetch(`https://7cf074eeac80e141.mokky.dev/invoice/${existing.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(existing),
			})
		} else {
			// 3. Создаём новую запись
			const newRecord = {
				id: clientId, // ← ID совпадает с clientId!
				clientId: client.id,
				clientName: client.client + ' ' + client.place,
				invoices: [newInvoice],
			}
			await fetch('https://7cf074eeac80e141.mokky.dev/invoice', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newRecord),
			})
		}

		alert(`Накладная ${invoiceNumber} сохранена!`)
		invoiceDialog.close()
	} catch (err) {
		console.error('Ошибка сохранения:', err)
		alert('Не удалось сохранить накладную')
	} finally {
		hideLoading()
	}
})

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

function resetInvoiceItems() {
	invoiceItemsContainer.innerHTML = `
		<div class="invoice-item">
			<input type="text" class="item-name" placeholder="Товар" required>
			<input type="number" class="item-qty" placeholder="Кол-во" min="1" value="1" required>
			<input type="number" class="item-price" placeholder="Цена" min="0" step="0.01" required>
			<button type="button" class="btn delete-btn remove-item">Удалить</button>
		</div>
	`
	addItemEventListeners()
}

function addInvoiceItem() {
	const itemDiv = document.createElement('div')
	itemDiv.className = 'invoice-item'
	itemDiv.innerHTML = `
		<input type="text" class="item-name" placeholder="Товар" required>
		<input type="number" class="item-qty" placeholder="Кол-во" min="1" value="1" required>
		<input type="number" class="item-price" placeholder="Цена" min="0" step="0.01" required>
		<button type="button" class="btn delete-btn remove-item">Удалить</button>
	`
	invoiceItemsContainer.appendChild(itemDiv)
	addItemEventListeners()
}

function addItemEventListeners() {
	document.querySelectorAll('.remove-item').forEach(btn => {
		btn.onclick = () => btn.closest('.invoice-item').remove()
	})

	// Обновление превью при изменении
	document
		.querySelectorAll('.item-name, .item-qty, .item-price')
		.forEach(input => {
			input.oninput = updateInvoicePreview
		})
}

function getInvoiceItems() {
	const items = []
	document.querySelectorAll('.invoice-item').forEach(itemEl => {
		const name = itemEl.querySelector('.item-name').value.trim()
		const qty = parseFloat(itemEl.querySelector('.item-qty').value) || 0
		const price = parseFloat(itemEl.querySelector('.item-price').value) || 0

		if (name && qty > 0 && price >= 0) {
			items.push({
				name,
				quantity: qty,
				price,
				total: qty * price,
			})
		}
	})
	return items
}

function updateInvoicePreview() {
	const items = getInvoiceItems()
	if (items.length === 0) {
		invoicePreview.style.display = 'none'
		return
	}

	let html = '<table style="width:100%; border-collapse: collapse;">'
	html += '<tr><th>Товар</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr>'
	items.forEach(item => {
		html += `<tr>
			<td>${item.name}</td>
			<td>${item.quantity}</td>
			<td>${item.price.toFixed(2)}</td>
			<td>${item.total.toFixed(2)}</td>
		</tr>`
	})
	const total = items.reduce((sum, item) => sum + item.total, 0)
	html += `<tr><td colspan="3" style="text-align:right;"><strong>Итого:</strong></td><td><strong>${total.toFixed(
		2
	)}</strong></td></tr>`
	html += '</table>'

	previewContent.innerHTML = html
	invoicePreview.style.display = 'block'
}
// === ПРОСМОТР НАКЛАДНЫХ ===
// === ПРОСМОТР НАКЛАДНЫХ С ПОИСКОМ ===
const viewInvoicesBtn = document.getElementById('viewInvoicesBtn')
const invoicesViewDialog = document.getElementById('invoicesViewDialog')
const closeInvoicesView = document.getElementById('closeInvoicesView')
const invoicesList = document.getElementById('invoicesList')
let allInvoicesData = [] // глобальное хранилище для поиска

viewInvoicesBtn?.addEventListener('click', async () => {
	showLoading()
	try {
		const response = await fetch('https://7cf074eeac80e141.mokky.dev/invoice')
		const clientRecords = await response.json() // ← локальная переменная
		originalClientRecords = clientRecords
		renderInvoicesList(clientRecords) // ← передаём как параметр
		invoicesViewDialog.showModal()
	} catch (err) {
		console.error('Ошибка загрузки накладных:', err)
		alert('Не удалось загрузить накладные')
	} finally {
		hideLoading()
	}
})
// Новая функция отрисовки
// === ФУНКЦИЯ ОТРИСОВКИ НАКЛАДНЫХ ===
function renderInvoicesList(clientRecords) {
	// ← ПРИНИМАЕТ ДАННЫЕ КАК ПАРАМЕТР
	let html = ''

	// Защита от некорректных данных
	if (!Array.isArray(clientRecords)) {
		html = '<p>Ошибка: данные повреждены</p>'
		invoicesList.innerHTML = html
		return
	}

	clientRecords.forEach(record => {
		// ← record определён здесь
		html += `<h3>${record.clientName || 'Неизвестен'} (ID: ${
			record.clientId || '—'
		})</h3>`
		html += `<div class="client-invoices">`

		// Защита от отсутствующего invoices
		const invoicesArray = Array.isArray(record.invoices) ? record.invoices : []
		const sortedInvoices = [...invoicesArray].sort(
			(a, b) => new Date(b.createdAt) - new Date(a.createdAt)
		)

		sortedInvoices.forEach(inv => {
			const date = new Date(inv.createdAt).toLocaleDateString('ru-RU')
			const total = (inv.totalAmount || 0).toFixed(2)
			const items = (inv.items || []).map(i => i.name || '—').join(', ')

			html += `
				<div class="invoice-item-preview" 
				     data-invoice="${encodeURIComponent(JSON.stringify(inv))}"
				     data-client-id="${record.clientId || ''}"
				     data-record-id="${record.id || ''}"
				     data-invoice-id="${inv.id || ''}">
					<strong>${
						inv.invoiceNumber || 'Без номера'
					}</strong> от ${date} — ${total} сомони
					<br><small>Товары: ${items}</small>
					<br>
					<button class="btn info-btn print-invoice-btn">🖨 Печать</button>
					 <button class="btn info-btn print-invoice-double-btn">🖨🖨 Двойная печать</button>
					<button class="btn warning-btn download-invoice-btn">💾 Скачать</button>
					<button class="btn delete-btn delete-invoice-btn">🗑 Удалить</button>
				</div>
			`
		})
		html += `</div><hr>`
	})

	if (clientRecords.length === 0) {
		html = '<p>Нет сохранённых накладных</p>'
	}

	invoicesList.innerHTML = html

	// Подключаем обработчики
	document.querySelectorAll('.print-invoice-btn').forEach(btn => {
		btn.addEventListener('click', e => {
			const invoiceDiv = e.target.closest('.invoice-item-preview')
			const invoice = JSON.parse(decodeURIComponent(invoiceDiv.dataset.invoice))
			const clientId = Number(invoiceDiv.dataset.clientId)
			const client = fullClientList.find(c => c.id === clientId)

			printInvoice(
				invoice,
				client?.client || 'Не указан',
				client?.place || '',
				client?.phoneNumber?.[0] || ''
			)
		})
	})
// НОВЫЙ КОД: Обработчик двойной печати
document.querySelectorAll('.print-invoice-double-btn').forEach(btn => {
    btn.addEventListener('click', e => {
        const invoiceDiv = e.target.closest('.invoice-item-preview')
        const invoice = JSON.parse(decodeURIComponent(invoiceDiv.dataset.invoice))
        const clientId = Number(invoiceDiv.dataset.clientId)
        const client = fullClientList.find(c => c.id === clientId)

        // Вызываем НОВУЮ функцию (создадим её в шаге 3)
        printInvoiceDouble(
            invoice,
            client?.client || 'Не указан',
            client?.place || '',
            client?.phoneNumber?.[0] || ''
        )
    })
})
	document.querySelectorAll('.download-invoice-btn').forEach(btn => {
		btn.addEventListener('click', async e => {
			const invoiceDiv = e.target.closest('.invoice-item-preview')
			const invoice = JSON.parse(decodeURIComponent(invoiceDiv.dataset.invoice))
			const clientId = Number(invoiceDiv.dataset.clientId)
			const client = fullClientList.find(c => c.id === clientId)
			const clientName = client?.client || 'Не указан'

			// Создаём временный элемент для PDF
			const pdfElement = document.createElement('div')
			pdfElement.innerHTML = `
			<div id="pdf-invoice" style="padding: 20px; font-family: Arial, sans-serif; max-width: 800px;">
				<h2 style="text-align: center; margin-bottom: 20px;">НАКЛАДНАЯ</h2>
				<div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
					<div><strong>Номер:</strong> ${invoice.invoiceNumber || '—'}</div>
					<div><strong>Дата:</strong> ${new Date(invoice.createdAt).toLocaleDateString(
						'ru-RU'
					)}</div>
				</div>
				<div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
					<div><strong>Компания:</strong> M.M.C +992 988-66-77-75 </div>
					<div><strong>Клиент: ${client?.phoneNumber}</strong> ${
				clientName + ' ' + client?.place
			}</div>
				</div>
				<table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
					<thead>
						<tr>
							<th style="border: 1px solid #000; padding: 8px; background: #f0f0f0;color:black;">Товар</th>
							<th style="border: 1px solid #000; padding: 8px; background: #f0f0f0;color:black;">Кол-во</th>
							<th style="border: 1px solid #000; padding: 8px; background: #f0f0f0;color:black;">Цена</th>
							<th style="border: 1px solid #000; padding: 8px; background: #f0f0f0;color:black;">Сумма</th>
						</tr>
					</thead>
					<tbody>
						${(invoice.items || [])
							.map(
								item => `
							<tr>
								<td style="border: 1px solid #000; padding: 8px;">${item.name || '—'}</td>
								<td style="border: 1px solid #000; padding: 8px;">${item.quantity || 0}</td>
								<td style="border: 1px solid #000; padding: 8px;">${(item.price || 0).toFixed(
									2
								)}</td>
								<td style="border: 1px solid #000; padding: 8px;">${(item.total || 0).toFixed(
									2
								)}</td>
							</tr>
						`
							)
							.join('')}
					</tbody>
				</table>
				<div style="text-align: right; font-weight: bold; font-size: 18px; margin-top: 10px;">
					Итого: ${(invoice.totalAmount || 0).toFixed(2)} сомони
				</div>
				<div style="margin-top: 30px; display: flex; justify-content: space-between;">
					<div style="text-align: center;">
						<div>Подпись клиента</div>
						<div style="width: 200px; border-top: 1px solid #000; margin: 5px auto;"></div>
					</div>
					<div style="text-align: center;">
						<img src="./ПОДПИСЬ_ИСМИОЛ-removebg-preview.png" alt="Логотип" style="height: 80px;width:80px; margin-bottom: 10px;"/>
						<div style="width: 200px; border-top: 1px solid #000; margin: 5px auto;"></div>
					</div>
				</div>
			</div>
		`

			// Добавляем во временное DOM
			document.body.appendChild(pdfElement)

			try {
				// Генерируем PDF
				const canvas = await html2canvas(
					pdfElement.querySelector('#pdf-invoice')
				)
				const imgData = canvas.toDataURL('image/png')
				const pdf = new jspdf.jsPDF('p', 'mm', 'a4')
				const imgWidth = 210 // A4 width in mm
				const pageHeight = 297 // A4 height in mm
				const imgHeight = (canvas.height * imgWidth) / canvas.width
				let heightLeft = imgHeight
				let position = 0

				pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
				heightLeft -= pageHeight

				while (heightLeft >= 0) {
					position = heightLeft - imgHeight
					pdf.addPage()
					pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
					heightLeft -= pageHeight
				}

				// Скачиваем
				pdf.save(
					`${
						clientName +
							' ' +
							new Date(invoice.createdAt).toLocaleDateString('ru-RU') +
							' ' +
							invoice.invoiceNumber || 'nakladnaya'
					}.pdf`
				)
			} catch (err) {
				console.error('Ошибка генерации PDF:', err)
				alert('Не удалось создать PDF')
			} finally {
				// Удаляем временный элемент
				document.body.removeChild(pdfElement)
			}
		})
	})

	document.querySelectorAll('.delete-invoice-btn').forEach(btn => {
		btn.addEventListener('click', async e => {
			if (!confirm('Удалить накладную?')) return

			const invoiceDiv = e.target.closest('.invoice-item-preview')
			const invoiceId = invoiceDiv.dataset.invoiceId
			const recordId = invoiceDiv.dataset.recordId

			// Получаем текущую запись
			const response = await fetch(
				`https://7cf074eeac80e141.mokky.dev/invoice/${recordId}`
			)
			const record = await response.json()

			// Удаляем накладную из массива
			record.invoices = record.invoices.filter(inv => inv.id !== invoiceId)

			// Если накладных не осталось — удаляем всю запись
			if (record.invoices.length === 0) {
				await fetch(`https://7cf074eeac80e141.mokky.dev/invoice/${recordId}`, {
					method: 'DELETE',
				})
			} else {
				await fetch(`https://7cf074eeac80e141.mokky.dev/invoice/${recordId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(record),
				})
			}

			alert('Накладная удалена')
			invoicesViewDialog.close()
			viewInvoicesBtn.click() // обновляем список
		})
	})
}

// === ПОИСК ПО НАКЛАДНЫМ ===
document.getElementById('invoiceSearch')?.addEventListener('input', e => {
	const searchTerm = e.target.value.trim().toLowerCase()

	if (searchTerm === '') {
		// Нужно хранить оригинальные данные!
		// Добавь глобальную переменную:
		// let originalClientRecords = [];

		renderInvoicesList(originalClientRecords)
		return
	}

	const filtered = originalClientRecords
		.map(record => {
			const filteredInvoices = (record.invoices || []).filter(
				inv =>
					(inv.invoiceNumber || '').toLowerCase().includes(searchTerm) ||
					(record.clientName || '').toLowerCase().includes(searchTerm) ||
					(inv.items || []).some(item =>
						(item.name || '').toLowerCase().includes(searchTerm)
					)
			)
			return { ...record, invoices: filteredInvoices }
		})
		.filter(record => (record.invoices || []).length > 0)

	renderInvoicesList(filtered)
})
closeInvoicesView?.addEventListener('click', () => {
	invoicesViewDialog.close()
	document.getElementById('invoiceSearch').value = '' // сброс поиска
})
// Функция печати накладной
// Функция печати накладной (красивая версия)
function printInvoice(invoice, clientName, place, phoneNumber) {
	// Форматируем дату
	const invoiceDate = new Date(invoice.createdAt)

	const totalAmount = invoice.totalAmount || 0
	const formattedDate = invoice.createdAt
		? new Date(invoice.createdAt).toISOString().split('T')[0]
		: new Date().toISOString().split('T')[0]
	// Генерируем строки таблицы
	const itemsHtml = invoice.items
		.map(
			item => `
		<tr>
			<td>${item.name}</td>
			<td>${item.quantity}</td>
			<td>${item.price.toFixed(2)}</td>
			<td class="sum">${item.total.toFixed(2)}</td>
			<td class="actions">✖️</td>
		</tr>
	`
		)
		.join('')

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
					<input type="text" value="M.M.C +992 988-66-77-75" readonly>
				</div>
				<div>
					<label>Клиент: ${phoneNumber}</label>
				<input type="text" value="${clientName + ' ' + place}" readonly>
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
				Общая сумма: <span id="totalSum">${invoice.totalAmount.toFixed(
					2
				)}</span> сомони.
			</div>

			<div class="signature">
				<div>
					Подпись клиента: <span></span>
				</div>
				<div>
				
					Подпись: <img src="./ПОДПИСЬ_ИСМИОЛ-removebg-preview.png" alt="Logo" style="height: 60px;width:60px; margin-bottom: 5px;"/><span></span>
				</div>
			</div>

			<script>
				// Автоматическая печать через 1 секунду
				setTimeout(() => window.print(), 500);
			</script>
		</body>
		</html>
	`

	const win = window.open('', '_blank')
	win.document.write(printContent)
	win.document.close()
	win.focus()
}
// Пересчитывает и обновляет общий долг в шапке
function updateTotalDebt() {
	const totalDebt = fullClientList.reduce(
		(sum, client) => sum + (parseFloat(client.credit) || 0),
		0
	)
	const allCreditElement = document.querySelector('.allCredit')
	if (allCreditElement) {
		allCreditElement.innerHTML = `<span>Қарз: ${Math.round(
			totalDebt
		)} сомони</span>`
	}
}

// === ЕДИНСТВЕННАЯ ФУНКЦИЯ РЕЗЕРВНОГО КОПИРОВАНИЯ ===
async function createFullBackup() {
	showLoading()
	try {
		const baseUrl = 'https://7cf074eeac80e141.mokky.dev'
		const collections = [
			'DilobarQurbanova',
			'MamatkulovMurodullo',
			'invoice',
			'activityLog',
		]

		// 1. Загружаем данные
		const data = {}
		for (const name of collections) {
			try {
				const res = await fetch(`${baseUrl}/${name}`)
				data[name] = res.ok ? await res.json() : []
			} catch {
				data[name] = []
			}
		}

		// 2. Создаём summary.json
		const totalClients =
			(data.DilobarQurbanova?.length || 0) +
			(data.MamatkulovMurodullo?.length || 0)
		const totalDebt = [
			...(data.DilobarQurbanova || []),
			...(data.MamatkulovMurodullo || []),
		].reduce((sum, c) => sum + (parseFloat(c.credit) || 0), 0)

		const summary = {
			totalClients,
			totalDebt: Math.round(totalDebt),
			dilobarClients: data.DilobarQurbanova?.length || 0,
			murodulloClients: data.MamatkulovMurodullo?.length || 0,
			dilobarDebt:
				data.DilobarQurbanova?.reduce(
					(s, c) => s + (parseFloat(c.credit) || 0),
					0
				) || 0,
			murodulloDebt:
				data.MamatkulovMurodullo?.reduce(
					(s, c) => s + (parseFloat(c.credit) || 0),
					0
				) || 0,
			backupDate: new Date().toISOString(),
		}

		// 3. ДОБАВЛЯЕМ summary в данные
		data.summary = summary

		// === СОЗДАНИЕ ZIP ===
		const script = document.createElement('script')
		script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'
		document.head.appendChild(script)
		await new Promise(r => (script.onload = r))

		const zip = new JSZip()
		const folderName = `backup_${new Date()
			.toISOString()
			.slice(0, 19)
			.replace(/[:T]/g, '-')}`
		const backupFolder = zip.folder(folderName)

		// Добавляем ВСЕ 5 файлов
		for (const [name, content] of Object.entries(data)) {
			backupFolder.file(`${name}.json`, JSON.stringify(content, null, 2))
		}

		// Скачиваем ZIP
		const blob = await zip.generateAsync({ type: 'blob' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = `${folderName}.zip`
		document.body.appendChild(a)
		a.click()
		document.body.removeChild(a)
		URL.revokeObjectURL(url)

		// === ЗАГРУЗКА В GIST (5 файлов) ===
		const GIST_ID = 'b4b97f987d163c0d4ec3ea3940562e90'
		const GITHUB_TOKEN = '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'

		const gistFiles = {}
		for (const [name, content] of Object.entries(data)) {
			gistFiles[`${name}.json`] = { content: JSON.stringify(content, null, 2) }
		}

		await fetch(`https://api.github.com/gists/${GIST_ID}`, {
			method: 'PATCH',
			headers: {
				Authorization: `token ${GITHUB_TOKEN}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ files: gistFiles }),
		})

		console.log('✅ Резервная копия: 5 файлов в ZIP и в Gist')
	} catch (error) {
		console.log(error)
	} finally {
		hideLoading()
	}
}
document
	.getElementById('backupDataBtn')
	?.addEventListener('click', createFullBackup)

// === АВТОМАТИЧЕСКОЕ НАПОМИНАНИЕ О РЕЗЕРВНОЙ КОПИИ ===
function checkAndShowBackupReminder() {
	const lastBackup = localStorage.getItem('lastBackupDate')
	const now = new Date().getTime()
	const oneDay = 24 * 60 * 60 * 1000 // 1 день

	// Если прошло больше суток с последнего бэкапа
	if (!lastBackup || now - parseInt(lastBackup) > oneDay) {
		// Показываем красивое уведомление
		const reminder = document.createElement('div')
		reminder.className = 'backup-reminder'
		reminder.innerHTML = `
			<div class="backup-reminder-content">
				<h3>💾 Напоминание</h3>
				<p>Вы не делали резервную копию больше суток.<br>Рекомендуем создать её сейчас.</p>
				<button class="btn info-btn" id="backupNow">Создать сейчас</button>
				<button class="btn" id="backupLater">Позже</button>
			</div>
		`
		document.body.appendChild(reminder)

		// Обработчик "Создать сейчас"
		document.getElementById('backupNow').addEventListener('click', async () => {
			reminder.remove()
			await createFullBackup()
			localStorage.setItem('lastBackupDate', new Date().getTime().toString())
			alert('✅ Резервная копия создана!')
		})

		// Обработчик "Позже"
		document.getElementById('backupLater').addEventListener('click', () => {
			reminder.remove()
			// Напомним через 2 часа
			setTimeout(checkAndShowBackupReminder, 2 * 60 * 60 * 1000)
		})
	}
}

// Проверяем при загрузке страницы
window.addEventListener('load', () => {
	// Ждём 5 секунд после загрузки, чтобы не мешать
	setTimeout(checkAndShowBackupReminder, 5000)
})

// Обновляем дату при успешном создании бэкапа
const originalBackupBtn = document.getElementById('backupDataBtn')
if (originalBackupBtn) {
	const originalClickHandler = originalBackupBtn.onclick
	originalBackupBtn.addEventListener('click', async () => {
		// Сохраняем дату после успешного бэкапа
		localStorage.setItem('lastBackupDate', new Date().getTime().toString())
	})
}

// === ПЕЧАТЬ ИСТОРИИ КЛИЕНТА ===
// === ПЕЧАТЬ ИСТОРИИ КЛИЕНТА ===
function printClientHistory(client) {
	// Общая сумма долгов
	const totalDebtHistory = (client.creditHistory || []).reduce((sum, item) => {
		const amountStr = item[1] || '0'
		const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0
		return sum + amount
	}, 0)

	// Общая сумма выплат
	const totalPaymentHistory = (client.viruchka || []).reduce((sum, item) => {
		const amountStr = item[1] || '0'
		const amount = parseFloat(amountStr.replace(/[^0-9.-]/g, '')) || 0
		return sum + amount
	}, 0)

	const printContent = `
		<!DOCTYPE html>
		<html lang="ru">
		<head>
			<meta charset="UTF-8">
			<title>История клиента ${client.client}</title>
			<style>
				* { box-sizing: border-box; }
				body {
					font-family: 'Arial', sans-serif;
					margin: 40px;
					color: #333;
					background: #fdfdfd;
				}
				h1, h2 {
					text-align: center;
					margin-bottom: 20px;
				}
				.header {
					text-align: center;
					margin-bottom: 30px;
					padding: 15px;
					background: #f8f9fa;
					border-radius: 8px;
				}
				.summary-box {
					display: flex;
					justify-content: space-around;
					margin: 20px 0;
					padding: 15px;
					background: #e9ecef;
					border-radius: 8px;
					font-weight: bold;
				}
				table {
					width: 100%;
					border-collapse: collapse;
					margin: 20px 0;
				}
				th, td {
					border: 1px solid #000;
					padding: 10px;
					text-align: left;
				}
				th {
					background-color: #e9ecef;
				}
				.total {
					text-align: right;
					font-weight: bold;
					font-size: 18px;
					margin-top: 20px;
				}
			</style>
		</head>
		<body>
			<div class="header">
				<h1>История клиента</h1>
				<p><strong>Имя:</strong> ${client.client}</p>
				<p><strong>Телефон:</strong> ${client.phoneNumber?.[0] || '—'}</p>
				<p><strong>Место:</strong> ${client.place || '—'}</p>
				<p><strong>Текущий долг:</strong> ${client.credit || 0} сомони</p>
			</div>

			<div class="summary-box">
				<div>Всего задолженно: ${totalDebtHistory.toFixed(2)} сомони</div>
				<div>Всего выплачено: ${totalPaymentHistory.toFixed(2)} сомони</div>
			</div>

			<h2>История долгов</h2>
			${renderHistoryTable(client.creditHistory || [], [
				'Дата',
				'Сумма',
				'Что купил',
			])}

			<h2>История выплат</h2>
			${renderHistoryTable(client.viruchka || [], ['Дата', 'Сумма', 'Способ оплаты'])}

			<script>
				setTimeout(() => window.print(), 500);
			</script>
		</body>
		</html>
	`

	const win = window.open('', '_blank')
	win.document.write(printContent)
	win.document.close()
	win.focus()
}

// Вспомогательная функция для генерации таблицы
function renderHistoryTable(data, headers) {
	if (data.length === 0) {
		return '<p>Нет записей</p>'
	}

	let html = '<table><thead><tr>'
	headers.forEach(header => {
		html += `<th>${header}</th>`
	})
	html += '</tr></thead><tbody>'

	data.forEach(row => {
		html += '<tr>'
		row.forEach(cell => {
			html += `<td>${cell || '—'}</td>`
		})
		html += '</tr>'
	})

	html += '</tbody></table>'
	return html
}

/**
 * Создает HTML для одной строки товара в модалке накладной (#invoiceItems).
 * @param {string} name - Название товара.
 * @param {number} qty - Количество.
 * @param {number} price - Цена за единицу.
 */
function createInvoiceItemHtml(name = '', qty = 1, price = 0) {
	// Используем встроенный обработчик для удаления, так как кнопки генерируются динамически
	return `
        <div class="invoice-item" style="display: flex; gap: 10px; margin-bottom: 8px;">
            <input type="text" class="item-name form-input" placeholder="Товар" value="${name}" required style="flex-grow: 3;"/>
            <input type="number" class="item-qty form-input" placeholder="Кол-во" min="1" value="${qty}" required style="width: 80px;"/>
            <input type="number" class="item-price form-input" placeholder="Цена" min="0" step="0.01" value="${price.toFixed(
							2
						)}" required style="width: 100px;"/>
            <button type="button" class="btn delete-btn remove-item" onclick="this.parentElement.remove()">Удалить</button>
        </div>
    `
}


/**
 * Собирает выбранные долги, парсит их и заполняет модалку #invoiceDialog.
 * @param {Object} client - Объект клиента (должен содержать id).
 */
function loadInvoiceModalFromDebt(client) {
    const selectedItemsData = [];
    const checkboxes = dialogInfo.querySelectorAll('.invoice-checkbox:checked');
    const invoiceDialog = document.getElementById('invoiceDialog');
    const invoiceItemsContainer = document.getElementById('invoiceItems');
    const invoiceClientSelect = document.getElementById('invoiceClient');

    if (checkboxes.length === 0) {
        alert('🚫 Пожалуйста, выберите хотя бы один товар для создания накладной.');
        return;
    }

    // 1. Собираем и парсим данные
    checkboxes.forEach(checkbox => {
        const index = parseInt(checkbox.value);
        const item = client.creditHistory[index];
        const details = item[2] || '';
        const totalAmount = parseFloat(item[1].replace(/[^0-9.]/g, '')) || 0; 
        
        let name = details;
        let qty = 1;
        let price = totalAmount; // По умолчанию, общая сумма

        // УНИВЕРСАЛЬНЫЙ ПАРСИНГ: Поддержка "X", "×", "x"
        // "Жинжони 10шт×170 сомони" → name="Жинжони", qty=10, price=170
        // "Загер 5штX36 сомони" → name="Загер", qty=5, price=36
        const match = details.match(/^(.+?)\s+(\d+)\s*шт[X×x]\s*([\d\.]+)/i);
        
        if (match) {
            name = match[1].trim();
            qty = parseInt(match[2]);
            price = parseFloat(match[3]);
        } else {
            // Если не удалось распарсить - берём всю строку как название
            name = details;
            qty = 1;
            price = totalAmount;
        }
        
        selectedItemsData.push({ name, qty, price });
    });

    // 2. Настройка поля выбора клиента
    if (invoiceClientSelect && client.id) {
        // Обновляем ГЛОБАЛЬНЫЙ список клиентов
        invoiceClients = [...fullClientList];
       
        
        // Очищаем и добавляем только текущего клиента
        invoiceClientSelect.innerHTML = `<option value="${client.id}" selected>${client.client}</option>`;
        invoiceClientSelect.disabled = true;
        
       
    }

    // 3. Устанавливаем текущую дату
    const dateInput = document.getElementById('invoiceDate');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    // 4. Заполняем список товаров с обновлением превью
    invoiceItemsContainer.innerHTML = '';
    selectedItemsData.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'invoice-item';
        itemDiv.innerHTML = `
            <input type="text" class="item-name" placeholder="Товар" value="${item.name}" required>
            <input type="number" class="item-qty" placeholder="Кол-во" min="1" value="${item.qty}" required>
            <input type="number" class="item-price" placeholder="Цена" min="0" step="0.01" value="${item.price.toFixed(2)}" required>
            <button type="button" class="btn delete-btn remove-item">Удалить</button>
        `;
        invoiceItemsContainer.appendChild(itemDiv);
    });

    // 5. Переподключаем обработчики
    addItemEventListeners();
    updateInvoicePreview(); // Обновляем превью

    // 6. Открываем модалку накладной
    dialogInfo.close();
    invoiceDialog.showModal();
}
function printInvoiceDouble(invoice, clientName, place, phoneNumber) {
	const invoiceDate = new Date(invoice.createdAt)
	const totalAmount = invoice.totalAmount || 0
	const formattedDate = invoice.createdAt
		? new Date(invoice.createdAt).toISOString().split('T')[0]
		: new Date().toISOString().split('T')[0]

	// Генерируем строки таблицы
	const itemsHtml = invoice.items
		.map(
			item => `
		<tr>
			<td>${item.name}</td>
			<td>${item.quantity}</td>
			<td>${item.price.toFixed(2)}</td>
			<td class="sum">${item.total.toFixed(2)}</td>
		</tr>
	`
		)
		.join('')

	const printContent = `
		<!DOCTYPE html>
		<html lang="ru">
		<head>
			<meta charset="UTF-8">
			<title>Накладная ${invoice.invoiceNumber}</title>
			<style>
				@page {
					size: A4;
					margin: 0;
				}
				
				* { box-sizing: border-box; margin: 0; padding: 0; }
				
				body {
					font-family: 'Arial', sans-serif;
					margin: 0;
					padding: 0;
					width: 210mm;
					height: 297mm;
					overflow: hidden;
				}
				
				.page-wrapper {
					width: 210mm;
					height: 297mm;
					position: relative;
				}
				
				.invoice-half {
					position: absolute;
					width: 210mm;
					height: 148.5mm;
					padding: 15mm;
					left: 0;
				}
				
				.invoice-half.top {
					top: 0;
					border-bottom: 1px dashed #999;
				}
				
				.invoice-half.bottom {
					bottom: 0;
					transform: rotate(180deg);
					transform-origin: center center;
				}
				
				h1 {
					text-align: center;
					margin-bottom: 10px;
					font-size: 24px;
				}
				
				.header, .details {
					display: flex;
		
					flex-wrap: wrap;
				}
				
				.header div, .details div {
					flex: 1 1 45%;
					
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
					margin-top: 10px;
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
				
				.signature img {
					height: 60px;
					width: 60px;
					display: block;
					margin: 0 auto 5px;
				}
				
				@media print {
					.actions { display: none !important; }
					input { border: none !important; }
					body {
						-webkit-print-color-adjust: exact;
						print-color-adjust: exact;
					}
					.page-wrapper {
						page-break-inside: avoid !important;
						page-break-after: avoid !important;
					}
				}
			</style>
		</head>
		<body>
			<div class="page-wrapper">
				<!-- ВЕРХНЯЯ НАКЛАДНАЯ (ОРИГИНАЛ) -->
				<div class="invoice-half top">
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
							<input type="text" value="M.M.C +992 988-66-77-75" readonly>
						</div>
						<div>
							<label>Клиент: ${phoneNumber}</label>
							<input type="text" value="${clientName + ' ' + place}" readonly>
						</div>
					</div>

					<table>
						<thead>
							<tr>
								<th>Наименование товара</th>
								<th>Кол-во</th>
								<th>Цена</th>
								<th>Сумма</th>
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
							<img src="./ПОДПИСЬ_ИСМИОЛ-removebg-preview.png" alt="Logo"/>
							Подпись: <span></span>
						</div>
					</div>
				</div>
				
				<!-- НИЖНЯЯ НАКЛАДНАЯ (КОПИЯ, ПЕРЕВЁРНУТАЯ) -->
				<div class="invoice-half bottom">
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
							<input type="text" value="M.M.C +992 988-66-77-75" readonly>
						</div>
						<div>
							<label>Клиент: ${phoneNumber}</label>
							<input type="text" value="${clientName + ' ' + place}" readonly>
						</div>
					</div>

					<table>
						<thead>
							<tr>
								<th>Наименование товара</th>
								<th>Кол-во</th>
								<th>Цена</th>
								<th>Сумма</th>
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
							<img src="./ПОДПИСЬ_ИСМИОЛ-removebg-preview.png" alt="Logo"/>
							Подпись: <span></span>
						</div>
					</div>
				</div>
			</div>

			<script>
				// Автоматическая печать через 1 секунду
				setTimeout(() => window.print(), 500);
			</script>
		</body>
		</html>
	`

	const win = window.open('', '_blank')
	win.document.write(printContent)
	win.document.close()
	win.focus()
}





let allZones = []; // Глобальный кэш зон

/**
 * Загружает зоны с сервера и заполняет все select[name="place"]
 */
export async function loadAndPopulateZones() {
	if (!navigator.onLine) return;

	try {
		allZones = await getZones();
		
		// Находим ВСЕ селекты с name="place"
		const placeSelects = document.querySelectorAll('select[name="place"]');
		
		placeSelects.forEach(select => {
			// Сохраняем текущий выбор (если есть)
			const currentValue = select.value;
			
			// Очищаем и добавляем дефолтный option
			select.innerHTML = '<option value="">Выберите место</option>';
			
			// Добавляем зоны
			allZones.forEach(zone => {
				const option = document.createElement('option');
				option.value = zone.value; // ← ВОТ КЛЮЧЕВОЕ: value из API
				option.textContent = zone.name; // ← А отображается name
				select.appendChild(option);
			});
			
			// Восстанавливаем выбор (если зона всё ещё существует)
			if (currentValue && allZones.some(z => z.value === currentValue)) {
				select.value = currentValue;
			}
		});
	} catch (error) {
		console.error('Ошибка загрузки зон:', error);
	}
}

// === МОДАЛЬНОЕ ОКНО УПРАВЛЕНИЯ ЗОНАМИ ===
const manageZonesBtn = document.getElementById('manageZonesBtn');
const zonesDialog = document.getElementById('zonesDialog');
const closeZonesDialog = document.getElementById('closeZonesDialog');
const zonesList = document.getElementById('zonesList');
const addZoneForm = document.getElementById('addZoneForm');
const newZoneInput = document.getElementById('newZoneName');

// Открытие диалога
manageZonesBtn?.addEventListener('click', async () => {
	if (!navigator.onLine) {
		alert('🚫 Нет интернета');
		return;
	}
	
	await renderZonesList();
	zonesDialog.showModal();
});

// Закрытие
closeZonesDialog?.addEventListener('click', () => {
	zonesDialog.close();
	newZoneInput.value = '';
});

// Добавление новой зоны
// Добавление новой зоны
addZoneForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const zoneName = newZoneInput.value.trim();
  
  if (!zoneName) {
    alert('❌ Введите название зоны');
    return;
  }

  // --- ВОТ ИЗМЕНЕНИЕ ---
  // Генерируем value: "102 микрорайон" -> "102-микрорайон"
  // Мы также приводим к нижнему регистру для единообразия value
  const zoneValue = zoneName.toLowerCase().replace(/\s+/g, '-');
  // --- КОНЕЦ ИЗМЕНЕНИЯ ---

  showLoading();
  
  try {
    const success = await addZone(zoneName, zoneValue); // Отправляем оба значения
    if (success) {
      newZoneInput.value = ''; // Очищаем только одно поле
      // document.getElementById('newZoneValue').value = ''; // Это поле больше не существует
      await loadAndPopulateZones(); // Обновляем все select'ы
      await renderZonesList(); // Обновляем список в модалке
    }
  } catch (error) {
    console.error('Ошибка:', error);
  } finally {
    hideLoading();
  }
});



/**
 * Отрисовывает список зон в модальном окне
 */
async function renderZonesList() {
	showLoading();
	
	try {
		allZones = await getZones();
		
		if (allZones.length === 0) {
			zonesList.innerHTML = '<p style="text-align:center; color:#999;">Нет зон</p>';
			return;
		}
		
		let html = '<ul class="zones-list">';
		
		allZones.forEach(zone => {
			html += `
				<li class="zone-item" data-id="${zone.id}">
					<div class="zone-info">
						<div class="zone-name">${zone.name}</div>
						<div class="zone-value">value: "${zone.value}"</div>
					</div>
					<div class="zone-actions">
						<button class="btn edit-btn edit-zone-btn" 
							data-id="${zone.id}" 
							data-name="${zone.name}"
							data-value="${zone.value}">
							✏️ Изменить
						</button>
						<button class="btn delete-btn delete-zone-btn" 
							data-id="${zone.id}" 
							data-name="${zone.name}">
							🗑 Удалить
						</button>
					</div>
				</li>
			`;
		});
		
		html += '</ul>';
		zonesList.innerHTML = html;
		
		// Подключаем обработчики
		attachZoneEventListeners();
		
	} catch (error) {
		console.error('Ошибка рендеринга зон:', error);
		zonesList.innerHTML = '<p style="color:red;">Ошибка загрузки зон</p>';
	} finally {
		hideLoading();
	}
}

/**
 * Подключает обработчики к кнопкам удаления/редактирования
 */
function attachZoneEventListeners() {
    // Удаление
    document.querySelectorAll('.delete-zone-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const zoneId = Number(btn.dataset.id);
            const zoneName = btn.dataset.name;
            
            if (!confirm(`Удалить зону "${zoneName}"?\n\n⚠️ Это не изменит существующих клиентов.`)) {
                return;
            }
            
            showLoading();
            
            try {
                const success = await deleteZone(zoneId, zoneName);
                if (success) {
                    await loadAndPopulateZones();
                    await renderZonesList();
                } else {
                    // --- ДОБАВЛЕНО ---
                    // Если success = false, но ошибки не было, скажем об этом
                    alert('Не удалось удалить зону. Сервер не вернул ошибку, но удаление не было успешным.');
                    // --- КОНЕЦ ДОБАВЛЕНИЯ ---
                }

            } catch (error) {
                // --- ИЗМЕНЕНО ---
                // Раньше было только console.error
                console.error('Ошибка удаления:', error);
                alert(`🚫 Не удалось удалить зону "${zoneName}"!\n\n${error.message || error}`);
                // --- КОНЕЦ ИЗМЕНЕНИЯ ---

            } finally {
                hideLoading();
            }
        });
    });
    
    // Редактирование
 // Редактирование
document.querySelectorAll('.edit-zone-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        const zoneId = Number(btn.dataset.id);
        const oldName = btn.dataset.name;
        const oldValue = btn.dataset.value;

        // 1. Запрашиваем новое имя у пользователя
        const newName = prompt(`✏️ Введите новое название для зоны "${oldName}":`, oldName);

        if (!newName || newName.trim() === oldName) {
            // Пользователь нажал Отмена или не изменил имя
            return;
        }
        
        const trimmedNewName = newName.trim();

        // 2. Генерируем новое значение (value) по той же логике, что и при добавлении
        // "Новое Имя" -> "новое-имя"
        const newZoneValue = trimmedNewName.toLowerCase().replace(/\s+/g, '-');

        showLoading();

        try {
            // 3. Вызываем функцию обновления на сервере
            const success = await updateZone(zoneId, trimmedNewName, newZoneValue); 

            if (success) {
                alert(`✅ Зона "${oldName}" успешно изменена на "${trimmedNewName}"!`);
                
                // 4. Обновляем все селекты и список зон
                await loadAndPopulateZones(); 
                await renderZonesList(); 
            } else {
                alert('Не удалось обновить зону. Пожалуйста, попробуйте еще раз.');
            }
        } catch (error) {
            console.error('Ошибка редактирования зоны:', error);
            alert(`🚫 Ошибка при редактировании зоны "${oldName}"!\n\n${error.message || error}`);
        } finally {
            hideLoading();
        }
    });
});
}

// === АВТОЗАГРУЗКА ПРИ СТАРТЕ ===
window.addEventListener('load', async () => {
	if (navigator.onLine) {
		await loadAndPopulateZones();
	}
});

// === ПЕРЕЗАГРУЗКА ПРИ ВОССТАНОВЛЕНИИ ИНТЕРНЕТА ===
window.addEventListener('online', async () => {
	await loadAndPopulateZones();
});

// === (НОВЫЙ) ЛОГИКА ЗАКРЫТИЯ ДИАЛОГОВ ПО КЛИКУ НА ФОН ===

// Находим все диалоговые окна на странице
const allDialogs = document.querySelectorAll('dialog');

allDialogs.forEach(dialog => {
  dialog.addEventListener('click', (e) => {
    
    // Получаем "коробку" (прямоугольник) с размерами и положением диалога
    const dialogRect = dialog.getBoundingClientRect();

    // e.clientX и e.clientY — это координаты, где был клик
    
    // Проверяем, был ли клик ВНЕ этой "коробки"
    const isClickOutside = (
      e.clientY < dialogRect.top ||    // Выше окна
      e.clientY > dialogRect.bottom || // Ниже окна
      e.clientX < dialogRect.left ||   // Левее окна
      e.clientX > dialogRect.right     // Правее окна
    );

    // Если клик был снаружи, закрываем
    if (isClickOutside) {
      dialog.close();
    }
  });
});

// === КОНЕЦ ЛОГИКИ ===

