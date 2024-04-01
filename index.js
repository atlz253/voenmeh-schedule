class CustomElement extends HTMLElement {
  clear() {
    this.innerHTML = "";
  }

  static get customComponentTagName() {
    return "schedule-custom-element";
  }
}

class NavigatorElement extends CustomElement {
  constructor() {
    super();

    this.schedulesList = elementBuilder.build({ tagName: SchedulesList.customComponentTagName });

    window.addEventListener("popstate", (event) =>
      this.changeState({ ...event.state, saveToHistory: false })
    );
  }

  connectedCallback() {
    this.changeState({ state: navigatorStates.schedulesList, replaceState: true });
  }

  changeState(stateInfo) {
    this.clear();
    this.#setState(stateInfo);
    this.#saveStateToHistoryIfNeeded(stateInfo);
  }

  clear() {
    super.clear();
    panel.innerHTML = "";
  }

  #setState(stateInfo) {
    const { state } = stateInfo;

    switch (state) {
      case navigatorStates.schedulesList:
        this.appendChild(this.schedulesList);
        break;
      case navigatorStates.group:
        const { group } = stateInfo;
        this.groupElement = elementBuilder.build({
          tagName: GroupElement.customComponentTagName,
          parent: this,
          fields: { group },
        });
        break;
      default:
        throw new Error(`Не удалось восстановить состояние истории для ${element}`);
    }
  }

  #saveStateToHistoryIfNeeded(stateInfo) {
    const { replaceState, saveToHistory } = stateInfo;

    if (saveToHistory !== undefined && !saveToHistory) {
      return;
    } else if (replaceState) {
      window.history.replaceState(stateInfo, "");
    } else {
      window.history.pushState(stateInfo, "");
    }
  }

  static get customComponentTagName() {
    return "schedule-navigator";
  }
}

class SchedulesList extends CustomElement {
  constructor() {
    super();

    this.groupsList = elementBuilder.build({
      prototype: elementsPrototypes.list,
      is: GroupsList.customComponentTagName,
    });
    this.lecturersList = elementBuilder.build({
      prototype: elementsPrototypes.list,
      is: LecturersList.customComponentTagName,
    });
    this.lecturersElement = elementBuilder.build({ prototype: elementsPrototypes.list });
    this.groupsScheduleButton = elementBuilder.build({
      prototype: elementsPrototypes.button,
      textContent: "Расписание групп",
      onclick: () => this.#showGroupsList(),
      classList: ["button_active"]
    });
    this.lecturersScheduleButton = elementBuilder.build({
      prototype: elementsPrototypes.button,
      textContent: "Расписание преподавателей",
      onclick: () => this.#showLecturersList(),
    });
  }

  connectedCallback() {
    this.#showGroupsList();
    panel.appendChild(this.groupsScheduleButton);
    panel.appendChild(this.lecturersScheduleButton);
  }

  #showGroupsList() {
    this.clear();
    this.groupsScheduleButton.classList.add("button_active");
    this.groupsScheduleButton.disabled = true;
    this.lecturersScheduleButton.classList.remove("button_active");
    this.lecturersScheduleButton.disabled = false;
    this.appendChild(this.groupsList);
  }

  #showLecturersList() {
    this.clear();
    this.groupsScheduleButton.classList.remove("button_active");
    this.groupsScheduleButton.disabled = false;
    this.lecturersScheduleButton.classList.add("button_active");
    this.lecturersScheduleButton.disabled = true;
    this.appendChild(this.lecturersList);
  }

  static get customComponentTagName() {
    return "schedule-schedules-list";
  }
}

class AbstractListElement extends HTMLUListElement {
  showLoader() {
    this.clear();
    elementBuilder.build({ tagName: "li", textContent: "Загрузка...", parent: this });
  }

  clear() {
    this.innerHTML = "";
  }

  isEmpty() {
    return this.childElementCount === 0;
  }

  static get customComponentTagName() {
    return "schedule-abstract-list";
  }
}

class GroupsList extends AbstractListElement {
  connectedCallback() {
    if (this.isEmpty()) {
      this.#getGroups();
    }
  }

  async #getGroups() {
    this.showLoader();
    const groupsSchedule = await VoenmehScheduleFetcher.tryGetGroupsSchedule();
    this.clear();
    for (const group of Object.values(groupsSchedule)) {
      this.appendChild(this.#createGroupElement(group));
    }
  }

  #createGroupElement(group) {
    return elementBuilder.build({
      prototype: elementsPrototypes.groupListItem,
      data: { group: group.name },
      onclick: () =>
        pageNavigator.changeState({
          state: navigatorStates.group,
          group,
        }),
    });
  }

  static get customComponentTagName() {
    return "schedule-groups-list";
  }
}

class LecturersList extends AbstractListElement {
  connectedCallback() {
    if (this.isEmpty()) {
      this.#getLecturers();
    }
  }

  async #getLecturers() {
    this.showLoader();
    const lecturersSchedule = await VoenmehScheduleFetcher.tryGetLecturersSchedule();
    console.log(lecturersSchedule);
    this.clear();
    for (const lecturer of Object.values(lecturersSchedule)) {
      this.appendChild(this.#createLecturerElement(lecturer));
    }
  }

  #createLecturerElement(lecturer) {
    return elementBuilder.build({
      prototype: elementsPrototypes.lecturerListItem,
      data: { name: lecturer.name, chair: lecturer.chair },
    });
  }

  static get customComponentTagName() {
    return "schedule-lecturers-list";
  }
}

class GroupElement extends HTMLElement {
  #currentDay;
  #currentWeekParity = 1;

  constructor() {
    super();

    this.titleElement = elementBuilder.build({ tagName: "h2" });
    this.weekParityToggleElement = elementBuilder.build({
      prototype: elementsPrototypes.weekParityToggle,
      parent: panel,
      onclick: () => (this.currentWeekParity = this.currentWeekParity === 1 ? 2 : 1),
    });
    this.dayScheduleElement = elementBuilder.build({
      prototype: elementsPrototypes.daySchedule,
      fields: { parity: this.currentWeekParity },
    });
    this.daysElement = elementBuilder.build({
      tagName: DaysElement.customComponentTagName,
      parent: panel,
    });
  }

  connectedCallback() {
    this.appendChild(this.titleElement);
    this.appendChild(this.dayScheduleElement);
  }

  set group(group) {
    this.groupElement = group;
    this.titleElement.textContent = group.name;
    this.currentDay = this.groupElement.days[0].dayName;
    this.currentWeekParity = 1;
    this.#updateDaysElement();
  }

  #updateDaysElement() {
    this.daysElement.days = this.groupElement.days.map((day) => ({
      day: day.dayName,
      callback: () => {
        this.currentDay = day.dayName;
        this.daysElement.currentDay = day.dayName;
      },
    }));
    this.daysElement.currentDay = this.currentDay;
  }

  get currentWeekParity() {
    return this.#currentWeekParity;
  }

  set currentWeekParity(parityNumber) {
    this.#currentWeekParity = parityNumber;
    this.weekParityToggleElement.textContent = weekParityButtonText[parityNumber];
    this.dayScheduleElement.parity = parityNumber;
  }

  get currentDay() {
    return this.#currentDay;
  }

  set currentDay(currentDay) {
    this.dayScheduleElement.schedule = this.groupElement.days.find(
      ({ dayName }) => dayName === currentDay
    );
    this.#currentDay = currentDay;
  }

  static get customComponentTagName() {
    return "schedule-group";
  }
}

class DaysElement extends HTMLElement {
  #currentDay;
  #daysElements = {};

  set days(days) {
    this.daysObjects = days;
    this.#daysElements = {};
    for (const { day, callback } of this.daysObjects) {
      this.#daysElements[day] = elementBuilder.build({
        prototype: elementsPrototypes.day,
        parent: this,
        textContent: daysShortenings[day],
        onclick: callback,
      });
    }
    this.#updateActiveDay();
  }

  get currentDay() {
    return this.#currentDay;
  }

  set currentDay(day) {
    this.#currentDay = day;
    this.#updateActiveDay();
  }

  #updateActiveDay() {
    const previousActiveDay = this.querySelector(".button_active");

    if (previousActiveDay !== null) {
      previousActiveDay.classList.remove("button_active");
    }

    const currentActiveDay = this.#daysElements[this.currentDay];

    if (currentActiveDay !== undefined) {
      this.#daysElements[this.currentDay].classList.add("button_active");
    }
  }

  static get customComponentTagName() {
    return "schedule-days";
  }
}

class DayScheduleTableElement extends HTMLTableElement {
  #parity = 1;

  constructor() {
    super();

    this.resizeObserver = this.#createResizeObserver();

    this.body = elementBuilder.build({ tagName: "tbody", parent: this });

    this.classList.add("scheduleDayTable");
  }

  #createResizeObserver() {
    const resizeObserver = new ResizeObserver(() => this.#updateResizableObjects());
    resizeObserver.observe(this);
    return resizeObserver;
  }

  set schedule(schedule) {
    this.scheduleObject = schedule;
    this.#updateSchedule();
    this.#updateResizableObjects();
  }

  get parity() {
    return this.#parity;
  }

  set parity(parity) {
    this.#parity = parity;
    this.#updateSchedule();
    this.#updateResizableObjects();
  }

  #updateResizableObjects() {
    this.#updateLessonsHeight();
    this.#updateTimePosition();
  }

  #updateLessonsHeight() {
    const lessons = this.querySelectorAll(LessonElement.customComponentTagName);

    if (this.rowElements === undefined) {
      return;
    }

    const rowKey = Object.keys(this.rowElements)[0];
    for (const lesson of lessons) {
      lesson.style.height = `${this.rowElements[rowKey].clientHeight * 18}px`;
    }
  }

  #updateTimePosition() {
    const timeElements = this.querySelectorAll(".timeRow:not(:first-child) .time");

    if (this.rowElements === undefined) {
      return;
    }

    const rowKey = Object.keys(this.rowElements)[0];
    for (const timeElement of timeElements) {
      timeElement.style.top = `${-5 - this.rowElements[rowKey].clientHeight}px`;
    }
  }

  #updateSchedule() {
    if (this.scheduleObject === undefined) {
      return;
    }

    const weekLessons =
      this.parity === 1 ? this.scheduleObject.oddWeekLessons : this.scheduleObject.evenWeekLessons;
    if (weekLessons.length === 0) {
      this.body.innerHTML = "В этот день нет занятий";
      return;
    }
    const startTime = Time.parse(weekLessons[0].time).getTimeWithMinutes(0);
    const endTime = Time.parse(weekLessons.at(-1).time).getPlusHoursAndMinutesTime(1, 30);
    this.#createTableForSchedule(startTime, endTime);
    this.#fillTimeColumns(startTime, endTime);
    for (const lesson of weekLessons) {
      this.rowElements[Time.parse(lesson.time).toString()].lesson = lesson;
    }
  }

  #createTableForSchedule(startTime, endTime) {
    this.rowElements = {};
    this.body.innerHTML = ""; // TODO: скрывать ненужные строки
    let currentTime = startTime;

    while (currentTime.time <= endTime.time) {
      this.rowElements[currentTime.toString()] = elementBuilder.build({
        tagName: "tr",
        is: DayScheduleTableRowElement.customComponentTagName,
        parent: this.body,
      });
      currentTime = currentTime.getPlusMinutesTime(5);
    }
  }

  #fillTimeColumns(startTime, endTime) {
    let currentTime = startTime;

    while (currentTime.getHours() <= endTime.getHours()) {
      this.#setRowDateTimeString(currentTime.toString());
      currentTime = currentTime.getPlusHoursTime(1);
    }
  }

  #setRowDateTimeString(timeString) {
    this.rowElements[timeString].dateTimeString = timeString;
  }

  static get customComponentTagName() {
    return "schedule-day-table";
  }
}

class DayScheduleTableRowElement extends HTMLTableRowElement {
  constructor() {
    super();

    this.timeColumn = elementBuilder.build({
      tagName: "td",
      classList: ["timeColumn"],
      parent: this,
    });
    this.scheduleColumn = elementBuilder.build({
      tagName: "td",
      classList: ["scheduleColumn"],
      parent: this,
    });

    this.classList.add("timeRow");
  }

  set lesson(lesson) {
    this.lessonElement = elementBuilder.build({
      tagName: LessonElement.customComponentTagName,
      fields: { lesson },
      parent: this.scheduleColumn,
    });
  }

  set dateTimeString(timeString) {
    elementBuilder.build({
      tagName: "span",
      classList: ["time"],
      textContent: timeString,
      parent: this.timeColumn,
    });
  }

  static get customComponentTagName() {
    return "schedule-day-tr";
  }
}

class LessonElement extends HTMLElement {
  connectedCallback() {
    elementBuilder.build({
      parent: this,
      children: [
        elementBuilder.build({
          textContent: this.#getLessonIntervalString(this.lessonObject.time),
        }),
        elementBuilder.build({ textContent: this.lessonObject.classRoom }),
      ],
    });
    elementBuilder.build({
      parent: this,
      textContent: this.lessonObject.discipline,
    });
    elementBuilder.build({
      parent: this,
      textContent: this.lessonObject.lecturers.join(", "),
    });
  }

  #getLessonIntervalString(lessonStartTime) {
    return `${lessonStartTime} - ${Time.parse(lessonStartTime).getPlusHoursAndMinutesTime(1, 30)}`;
  }

  set lesson(lesson) {
    this.lessonObject = lesson;
  }

  static get dateTime() {
    return Time.parse(this.lessonObject.time);
  }

  static get customComponentTagName() {
    return "schedule-lesson";
  }
}

class Time {
  #minutes = 0;

  constructor(hours, minutes) {
    this.#minutes = this.getDayMinutes(hours * 60 + minutes);
  }

  static parse(dateTimeString) {
    const [hours, minutes] = dateTimeString.split(":");
    return new Time(parseInt(hours), parseInt(minutes));
  }

  static fromTime(time) {
    return new Time(Math.trunc(time / 60), time % 60);
  }

  get time() {
    return this.#minutes;
  }

  toString() {
    return `${this.#formatNumber(this.getHours())}:${this.#formatNumber(this.getMinutes())}`;
  }

  #formatNumber(number) {
    const numberString = number.toString();

    if (numberString.length === 2) {
      return numberString;
    } else {
      return "0" + numberString;
    }
  }

  getTimeWithMinutes(minutes) {
    if (minutes >= 60) {
      return Time.fromTime(this.getHours() * 60);
    } else {
      return Time.fromTime(this.getHours() * 60 + minutes);
    }
  }

  getHours() {
    return Math.trunc(this.#minutes / 60);
  }

  getTimeWithHours(hours) {
    if (hours >= 24) {
      return Time.fromTime(0);
    } else {
      return Time.fromTime(hours * 60 + this.getMinutes());
    }
  }

  getMinutes() {
    return this.#minutes % 60;
  }

  getPlusHoursAndMinutesTime(addendHours, addendMinutes) {
    return this.getPlusMinutesTime(addendHours * 60 + addendMinutes);
  }

  getPlusHoursTime(addend) {
    return this.getPlusMinutesTime(addend * 60);
  }

  getPlusMinutesTime(addend) {
    let time = this.getDayMinutes(this.#minutes + addend);
    return Time.fromTime(time);
  }

  getDayMinutes(minutes) {
    const minutesInDay = 24 * 60;
    if (minutes >= minutesInDay) {
      return minutes % minutesInDay;
    } else if (minutes < 0) {
      return 0;
    } else {
      return minutes;
    }
  }
}

class VoenmehScheduleFetcher {
  static groupsScheduleURL = "https://www.voenmeh.ru/templates/jd_atlanta/js/TimetableGroup46.xml";
  static lecturersScheduleURL =
    "https://www.voenmeh.ru/templates/jd_atlanta/js/TimetableLecturer46.xml";
  static domParser = new DOMParser();

  static async tryGetLecturersSchedule() {
    const xmlDocument = await this.tryFetchXMLDocument(this.lecturersScheduleURL);
    return XMLLecturersScheduleParser.parseToJSON(xmlDocument);
  }

  static async tryGetGroupsSchedule() {
    const xmlDocument = await this.tryFetchXMLDocument(this.groupsScheduleURL);
    return XMLGroupsScheduleParser.parseToJSON(xmlDocument);
  }

  static async tryFetchXMLDocument(url) {
    const xmlString = await this.#tryFetch(url);
    return this.domParser.parseFromString(xmlString, "text/xml");
  }

  static #tryFetch(url) {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();

      request.open("GET", this.#addCorsProxyToURL(url));

      request.send();

      request.onload = () => {
        if (request.status !== 200) {
          reject(`Не удалось получить расписание с сайта военмеха. Код ошибки: ${request.status}`);
        } else {
          resolve(request.response);
        }
      };
    });
  }

  /**
   * CORS ругается при попытке получения данных с сайтов, у которых другой домен.
   * Одним из способов решения является использование CORS-proxy: https://github.com/AverageMarcus/cors-proxy
   */
  static #addCorsProxyToURL(url) {
    return "https://cors-proxy.cluster.fun/" + url;
  }
}

class AbstractXMLScheduleParser {
  constructor(xmlDocument) {
    this.xmlDocument = xmlDocument;
  }

  static parseToJSON(xmlDocument) {
    const scheduleElements = this.getScheduleElements(xmlDocument);
    const schedules = {};

    for (const scheduleElement of scheduleElements) {
      if (this.isScheduleElementHaveChild(scheduleElement)) {
        const schedule = this.parseScheduleXML(scheduleElement);
        schedules[schedule.name] = schedule;
      }
    }

    return schedules;
  }

  static getScheduleElements(xmlDocument) {
    throw new Error(`Не удалось получить элементы расписаний`);
  }

  static isScheduleElementHaveChild(groupElement) {
    return groupElement.childElementCount !== 0;
  }

  static parseScheduleXML(scheduleElement) {
    const schedule = {
      days: [],
    };
    const dayElements = scheduleElement.querySelectorAll("Day");
    for (const dayElement of dayElements) {
      schedule.days.push(this.getDaySchedule(dayElement));
    }
    return schedule;
  }

  static getDaySchedule(dayElement) {
    const daySchedule = {
      dayName: dayElement.getAttribute("Title"),
      oddWeekLessons: [],
      evenWeekLessons: [],
    };
    const lessonElements = dayElement.querySelectorAll("Lesson");

    for (const lessonElement of lessonElements) {
      if (this.isOddWeekLessonElement(lessonElement)) {
        daySchedule.oddWeekLessons.push(this.parseLessonXML(lessonElement));
      } else {
        daySchedule.evenWeekLessons.push(this.parseLessonXML(lessonElement));
      }
    }

    return daySchedule;
  }

  static isOddWeekLessonElement(lessonElement) {
    return lessonElement.querySelector("WeekCode").textContent === "1";
  }

  static parseLessonXML(lesson) {
    return {
      time: this.parseLessonTime(lesson),
      discipline: lesson.querySelector("Discipline").textContent,
      classRoom: lesson.querySelector("Classroom").textContent.trim().slice(0, -1),
    };
  }

  static parseLessonTime(lesson) {
    const timeElement = lesson.querySelector("Time");
    return timeElement.textContent.split(" ")[0];
  }
}

class XMLGroupsScheduleParser extends AbstractXMLScheduleParser {
  static getScheduleElements(xmlDocument) {
    return xmlDocument.querySelectorAll("Group");
  }

  static parseScheduleXML(scheduleElement) {
    return {
      ...super.parseScheduleXML(scheduleElement),
      name: scheduleElement.getAttribute("Number"),
    };
  }

  static parseLessonXML(lesson) {
    return {
      ...super.parseLessonXML(lesson),
      lecturers: this.#parseLessonLecturers(lesson),
    };
  }

  static #parseLessonLecturers(lesson) {
    const lecturers = [];
    const lecturerElements = lesson.querySelectorAll("Lecturer");
    for (const lecturerElement of lecturerElements) {
      lecturers.push(lecturerElement.querySelector("ShortName").textContent);
    }
    return lecturers;
  }
}

class XMLLecturersScheduleParser extends AbstractXMLScheduleParser {
  static getScheduleElements(xmlDocument) {
    return xmlDocument.querySelectorAll("Lecturer");
  }

  static parseScheduleXML(scheduleElement) {
    return {
      ...super.parseScheduleXML(scheduleElement),
      name: scheduleElement.getAttribute("LecturerName"),
      chair: scheduleElement.getAttribute("Kafedra"),
    };
  }

  static parseLessonXML(lesson) {
    return {
      ...super.parseLessonXML(lesson),
      lecturers: this.#parseLessonGroups(lesson),
    };
  }

  static #parseLessonGroups(lesson) {
    const groups = [];
    const groupElements = lesson.querySelectorAll("Group");
    for (const groupElement of groupElements) {
      groups.push(groupElement.querySelector("Number").textContent);
    }
    return groups;
  }
}

class elementBuilder {
  static build({ prototype, ...props } = {}) {
    const { tagName, is, classList, parent, data, fields, children, onclick, textContent } =
      this.#mergePrototypeAndProps(props, prototype);
    const element = document.createElement(tagName, { is });
    element.onclick = onclick;
    this.#setClassList(element, classList);
    this.#setTextContent(element, textContent);
    this.#setData(element, data);
    this.#setFields(element, fields);
    parent?.appendChild(element);
    this.#setChildren(element, children);
    return element;
  }

  static #mergePrototypeAndProps(props, prototype = {}) {
    const { classList: prototypeClassList, ...prototypeTail } = prototype;
    const { classList: propsClassList, ...propsTail } = props;

    return {
      tagName: "div",
      ...prototypeTail,
      ...propsTail,
      classList: this.#mergeTwoArrays(prototypeClassList, propsClassList),
    };
  }

  static #mergeTwoArrays(firstArray = [], secondArray = []) {
    return [...firstArray, ...secondArray];
  }

  static #setClassList(element, classList = []) {
    if (classList.length !== 0) {
      element.classList.add(...classList);
    }
  }

  static #setTextContent(element, textContent = "") {
    if (textContent.length !== 0) {
      element.textContent = textContent;
    }
  }

  static #setData(element, data = {}) {
    for (const [key, value] of Object.entries(data)) {
      element.dataset[key] = value;
    }
  }

  static #setFields(element, fields = {}) {
    for (const [key, value] of Object.entries(fields)) {
      element[key] = value;
    }
  }

  static #setChildren(element, children = []) {
    for (const child of children) {
      element.appendChild(child);
    }
  }
}

customElements.define(CustomElement.customComponentTagName, CustomElement);
customElements.define(NavigatorElement.customComponentTagName, NavigatorElement);
customElements.define(SchedulesList.customComponentTagName, SchedulesList);
customElements.define(GroupsList.customComponentTagName, GroupsList, { extends: "ul" });
customElements.define(LecturersList.customComponentTagName, LecturersList, { extends: "ul" });
customElements.define(GroupElement.customComponentTagName, GroupElement);
customElements.define(DaysElement.customComponentTagName, DaysElement);
customElements.define(DayScheduleTableElement.customComponentTagName, DayScheduleTableElement, {
  extends: "table",
});
customElements.define(
  DayScheduleTableRowElement.customComponentTagName,
  DayScheduleTableRowElement,
  { extends: "tr" }
);
customElements.define(LessonElement.customComponentTagName, LessonElement);

const days = Object.freeze({
  monday: "Понедельник",
  tuesday: "Вторник",
  wednesday: "Среда",
  thursday: "Четверг",
  friday: "Пятница",
  saturday: "Суббота",
});
const daysShortenings = Object.freeze({
  Понедельник: "ПН",
  Вторник: "ВТ",
  Среда: "СР",
  Четверг: "ЧТ",
  Пятница: "ПТ",
  Суббота: "СБ",
});
const weekParityButtonText = Object.freeze({
  1: "Нечетная неделя",
  2: "Четная неделя",
});
const navigatorStates = Object.freeze({
  schedulesList: SchedulesList.customComponentTagName,
  group: GroupElement.customComponentTagName,
});
const elementsPrototypes = Object.freeze({
  groupListItem: Object.freeze({
    tagName: "li",
    classList: ["groupListItem"],
  }),
  lecturerListItem: Object.freeze({
    tagName: "li",
    classList: ["lecturerListItem"],
  }),
  button: Object.freeze({
    tagName: "button",
    classList: ["button"],
  }),
  weekParityToggle: Object.freeze({
    tagName: "button",
    classList: ["button", "weekParityToggle"],
    textContent: weekParityButtonText[this.currentWeekParity],
  }),
  daySchedule: Object.freeze({
    tagName: "table",
    is: DayScheduleTableElement.customComponentTagName,
  }),
  panel: Object.freeze({ tagName: "div", classList: ["panel"] }),
  day: Object.freeze({ tagName: "button", classList: ["button", "day"] }),
  list: Object.freeze({ tagName: "ul", classList: ["list"] }),
  panel: Object.freeze({ tagName: "div", classList: ["panel"] }),
});
const pageNavigator = elementBuilder.build({ tagName: NavigatorElement.customComponentTagName });
const panel = elementBuilder.build({ prototype: elementsPrototypes.panel });

document.body.appendChild(pageNavigator);
document.body.appendChild(panel);
