// dom.js — безопасная и понятная работа с интерфейсом

// === ИМПОРТЫ ===
import {
	deleteData,
	getData,
	logActivity,
	postData,
	putData,
	updateInvoicesForClient,
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
let currentClientId = null  // Хранит ID открытого клиента
let isProcessing = false    // Флаг: идёт ли сейчас запрос

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
	
	currentClientId = client.id
	
	clientInfo.textContent = `Клиент: ${client.client}`
	placeInfo.textContent = `Место: ${client.place}`
	creditInfo.innerHTML = `Долг: ${client.credit || 0} сомони<br>`
	
	renderDebtHistory(client)
	renderPaymentHistory(client)
	
	dialogInfo.showModal()
}

// === ОТРИСОВКА ИСТОРИИ ДОЛГОВ ===
function renderDebtHistory(client) {
	let table =
		'<table><tr><th>№</th><th>Дата</th><th>Сумма</th><th>Что купил</th><th>Действия</th></tr>'
	;(client.creditHistory || []).forEach((item, idx) => {
		table += `
			<tr>
				<td>${idx + 1}</td>
				<td>${item[0]}</td>
				<td>${item[1]}</td>
				<td>${item[2]}</td>
				<td><button class="delete-debt btn" data-id="${idx}">Удалить</button></td>
			</tr>`
	})
	table += '</table>'
	creditInfo.innerHTML += table

	// Безопасное удаление: используем data-id = индекс в массиве
	creditInfo.querySelectorAll('.delete-debt').forEach(btn => {
		btn.addEventListener('click', async () => {
			const idx = parseInt(btn.dataset.id)
			const history = client.creditHistory || []
			if (idx < 0 || idx >= history.length) return

			if (!confirm('Удалить запись о долге?')) return

			showLoading() // ← ПОКАЗАТЬ ЗАГРУЗКУ

			try {
				const removed = history.splice(idx, 1)[0]
				const amount = parseFloat(removed[1]) || 0
				const newCredit = Math.max(0, (parseFloat(client.credit) || 0) - amount)

				await logActivity(
					`Удалил запись долга: "${removed[0]}, ${removed[1]}, ${removed[2]}" у клиента "${client.client}"`
				)

				await putData(client.id, {
					...client,
					credit: newCredit,
					creditHistory: history,
				})

				dialogInfo.close()
				updateTotalDebt() // ← ДОБАВЬТЕ ЭТУ СТРОКУ
			} catch (err) {
				alert('Ошибка при удалении записи долга')
			} finally {
				hideLoading() // ← СКРЫТЬ В ЛЮБОМ СЛУЧАЕ
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
