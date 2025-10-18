// api.js — безопасная работа с API и журналом действий

// === 1. ИСПРАВЛЕННЫЕ URL (БЕЗ ПРОБЕЛОВ!) ===
let Api = 'https://7cf074eeac80e141.mokky.dev/DilobarQurbanova';
let Api2 = 'https://7cf074eeac80e141.mokky.dev/MamatkulovMurodullo';

// === 2. ГЛОБАЛЬНЫЕ ЭЛЕМЕНТЫ ===
const odamSelect = document.querySelector('.odam');
const allCreditElement = document.querySelector('.allCredit');

// === 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
const getCurrentUser = () => odamSelect.value; // "Dilobar" или "Murodullo"
/**
 * Загружает журнал действий
 * @param {string|null} dateFilter — фильтр по дате в формате 'YYYY-MM-DD'
 * @returns {Promise<Array>} — массив записей
 */
export async function getActivityLog(dateFilter = null) {
	if (!navigator.onLine) {
		alert('Нет интернета. Журнал недоступен.');
		return [];
	}

	try {
		const response = await fetch(ACTIVITY_LOG_API);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);

		let logs = await response.json();

		// Фильтрация по дате (если указана)
		if (dateFilter) {
			logs = logs.filter(entry => {
				const entryDate = new Date(entry.timestamp).toISOString().split('T')[0];
				return entryDate === dateFilter;
			});
		}

		return logs;
	} catch (error) {
		console.error('Ошибка загрузки журнала:', error);
		alert('Не удалось загрузить журнал действий');
		return [];
	}
}
// Меняем API при смене пользователя
odamSelect.addEventListener('change', () => {
	Api = getCurrentUser() === 'Murodullo' ? Api2 : 'https://7cf074eeac80e141.mokky.dev/DilobarQurbanova';
	if (navigator.onLine) {
		getData();
	}
});

// Импортируем функцию отрисовки из dom.js
import { getDataToTable } from './dom.js';

// === 4. ЖУРНАЛ ДЕЙСТВИЙ ===
const ACTIVITY_LOG_API = 'https://7cf074eeac80e141.mokky.dev/activityLog';

/**
 * Отправляет запись в журнал действий
 * @param {string} action — описание действия
 */
// В api.js — замени существующую logActivity на эту:

/**
 * Записывает действие в журнал
 * @param {string} action — полное описание действия на русском
 */
// В api.js

let _cachedLog = null; // кэш для уменьшения запросов

/**
 * Умная запись в журнал: группирует действия по дате
 * @param {string} action — описание действия
 */
// В api.js


export async function logActivity(action) {
	if (!navigator.onLine) return;

	// const today = new Date().toLocaleDateString('ru-RU');
	const today = new Date().toISOString().split('T')[0];
	const time = new Date().toLocaleTimeString('ru-RU')+` ${new Date().toLocaleDateString('ru-RU')}`;
	const user = getCurrentUser();

	try {
		if (!_cachedLog) {
			const response = await fetch(ACTIVITY_LOG_API);
			_cachedLog = await response.json();
		}

		let todayEntry = _cachedLog.find(item => item.date === today);

		if (todayEntry) {
			// ИСПРАВЛЕНО: PATCH вместо PUT
			todayEntry.actions.push({ time, user, action });
			const response = await fetch(`${ACTIVITY_LOG_API}/${todayEntry.id}`, {
				method: 'PATCH', // ← ВОТ КЛЮЧЕВОЕ ИЗМЕНЕНИЕ
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(todayEntry)
			});
			if (!response.ok) throw new Error('Не удалось обновить запись');
		} else {
			const newEntry = {
				date: today,
				actions: [{ time, user, action }]
			};
			const response = await fetch(ACTIVITY_LOG_API, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newEntry)
			});
			const created = await response.json();
			_cachedLog.push(created);
		}

	} catch (err) {
		console.warn('⚠️ Ошибка журнала:', err);
		_cachedLog = null; // сброс кэша
	}
}

// === 5. ОСНОВНЫЕ API-ФУНКЦИИ ===

/**
 * Получает всех клиентов и обновляет интерфейс
 */
export async function getData() {
	if (!navigator.onLine) return;

	try {
		const response = await fetch(Api);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);

		const data = await response.json();

		// Обновляем таблицу
		getDataToTable(data);

		// Обновляем общий долг
		const totalDebt = data.reduce((sum, client) => sum + (parseFloat(client.credit) || 0), 0);
		allCreditElement.innerHTML = `<span>Қарз: ${Math.round(totalDebt)} сомони</span>`;

	} catch (error) {
		console.error('❌ Ошибка загрузки данных:', error);
		// НЕ показываем alert — это мешает работе
	}
}

/**
 * Поиск клиентов по имени
 */
export async function searching(searchTerm) {
	if (!navigator.onLine || !searchTerm.trim()) {
		if (!searchTerm.trim()) {
			getData(); // если поле пустое — показываем всех
		}
		return;
	}

	try {
		const response = await fetch(`${Api}?client=${encodeURIComponent(searchTerm)}`);
		if (!response.ok) throw new Error(`HTTP ${response.status}`);

		const data = await response.json();
		getDataToTable(data);
	} catch (error) {
		console.error('❌ Ошибка поиска:', error);
	}
}

/**
 * Добавляет нового клиента
 * @param {Object} data — данные клиента
 */
export async function postData(data) {
	if (!navigator.onLine) {
		alert('🚫 Нет интернета. Добавление невозможно.');
		return false;
	}

	try {
		const response = await fetch(Api, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			const errorMsg = `HTTP ${response.status}`;
			console.error('❌ Ошибка добавления:', errorMsg);
			alert('❌ Не удалось добавить клиента. Проверьте соединение.');
			return false;
		}
		getData()
		const result = await response.json();
		await logActivity(`Добавлен клиент: ${result.client}`);
		return true; // успех

	} catch (error) {
		console.error('❌ Исключение при добавлении:', error);
		alert('❌ Ошибка сети. Попробуйте позже.');
		return false;
	}
}

/**
 * Удаляет клиента
 * @param {string} id — ID клиента
 * @param {string} clientName — имя клиента (для лога)
 */
export async function deleteData(id, clientName, phone = '') {
	if (!navigator.onLine) {
		alert('🚫 Нет интернета. Удаление невозможно.');
		return false;
	}

	try {
		const response = await fetch(`${Api}/${id}`, { method: 'DELETE' });

		if (!response.ok) {
			console.error('❌ Ошибка удаления:', `HTTP ${response.status}`);
			alert('❌ Не удалось удалить клиента.');
			return false;
		}

		// ✅ Используем переданные параметры
		await logActivity(`Удалил клиента "${clientName}" (телефон: ${phone || '—'})`);
		getData(); // обновляем список
		return true;

	} catch (error) {
		console.error('❌ Исключение при удалении:', error);
		alert('❌ Ошибка сети.');
		return false;
	}
}
/**
 * Обновляет данные клиента
 * @param {string} id — ID клиента
 * @param {Object} data — обновлённые данные
 */
export async function putData(id, data) {
	if (!navigator.onLine) {
		alert('🚫 Нет интернета. Изменение невозможно.');
		return false;
	}

	try {
		const response = await fetch(`${Api}/${id}`, {
			method: 'PATCH', // ← ВОТ КЛЮЧЕВОЕ ИЗМЕНЕНИЕ
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(data)
		});

		if (!response.ok) {
			alert('❌ Не удалось обновить данные.');
			return false;
		}

		getData(); // обновляем интерфейс
		return true;

	} catch (error) {
		alert('❌ Ошибка сети.');
		return false;
	}
}
// В api.js
export async function updateInvoicesForClient(clientId, newClientName) {
	if (!navigator.onLine) return;

	try {
		const response = await fetch(`https://7cf074eeac80e141.mokky.dev/invoice?clientId=${clientId}`);
		if (!response.ok) {
			console.warn('Не найдены накладные для клиента:', clientId);
			return;
		}
		const records = await response.json();

		for (const record of records) {
			const updateRes = await fetch(`https://7cf074eeac80e141.mokky.dev/invoice/${record.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ clientName: newClientName })
			});
			if (!updateRes.ok) {
				console.error('Не удалось обновить имя в накладной ID:', record.id);
			}
		}
	} catch (err) {
		console.error('Ошибка в updateInvoicesForClient:', err);
		// НЕ пробрасываем ошибку — чтобы не ломать основное обновление
	}
}