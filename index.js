const domParser = new DOMParser();
const bodyElement = document.querySelector("body");
const days = Object.freeze({
  monday: "Понедельник",
  tuesday: "Вторник",
  wednesday: "Среда",
  thursday: "Четверг",
  friday: "Пятница",
  saturday: "Суббота"
});
const daysShortenings = Object.freeze({
  "Понедельник": "ПН",
  "Вторник": "ВТ",
  "Среда": "СР",
  "Четверг": "ЧТ",
  "Пятница": "ПТ",
  "Суббота": "СБ"
});
const weekParityButtonText = Object.freeze({
  1: "Нечетная неделя",
  2: "Четная неделя"
});

class NavigatorElement extends HTMLElement {
  constructor() {
    super();
    this.#addHistoryChangeListener();
  }

  #addHistoryChangeListener() {
    window.addEventListener("popstate", (event) => {
      const { element } = event.state;

      switch (element) {
        case GroupsListElement.tagName:
          this.removeChild(this.groupElement);
          this.appendChild(this.groupsElement);
          break;
        case GroupElement.tagName:
          const { group } = event.state;
          this.#setGroupElement(this.schedule.getGroupByNumber(group));
          break;
        default:
          throw new Error("Не удалось восстановить состояние истории")
      }
    })
  }

  connectedCallback() {
    window.history.replaceState({
      element: GroupsListElement.tagName
    }, "");


    this.groupsElement = document.createElement(GroupsListElement.tagName);
    this.appendChild(this.groupsElement);

    this.#tryGetSchedule();
  }

  async #tryGetSchedule() {
    this.schedule = await tryGetSchedule();
    this.groupsElement.groups = this.schedule.groups;
  }

  navigateToGroup(group) {
    window.history.pushState({
      element: GroupElement.tagName,
      group: group.name
    }, "")

    this.#setGroupElement(group);
  }

  #setGroupElement(group) {
    this.groupElement = document.createElement(GroupElement.tagName);
    this.removeChild(this.groupsElement);
    this.appendChild(this.groupElement);
    this.groupElement.group = group;
  }

  static get tagName() {
    return "schedule-navigator";
  }
}

class GroupsListElement extends HTMLElement {
  set groups(groups) {
    this.groupsElements = groups;
    this.connectedCallback()
  }

  connectedCallback() {
    if (this.groupsElements === undefined) {
      this.innerHTML = "Загрузка групп..."
    }
    else {
      this.#createGroupsElements();
    }
  }

  #createGroupsElements() {
    this.innerHTML = "";
    for (const group of this.groupsElements) {
      const groupElement = document.createElement(GroupListItemElement.tagName);
      groupElement.group = group;
      this.appendChild(groupElement);
    }
  }

  static get tagName() {
    return "schedule-group-list";
  }
}

class GroupListItemElement extends HTMLElement {
  set group(group) {
    this.textContent = group.name;
    this.addEventListener("click", () => {
      navigatorElement.navigateToGroup(group);
    });
  }

  static get tagName() {
    return "schedule-group-list-item";
  }
}

class GroupElement extends HTMLElement {
  #currentDay;
  #currentWeekParity;

  connectedCallback() {
    this.appendChild(this.#createTitleElement());
    this.appendChild(this.#createDayScheduleElement());
    this.appendChild(this.#createPanelElement());
  }

  set group(group) {
    this.groupElement = group;
    this.currentDay = this.groupElement.days[0];
    this.currentWeekParity = 1;
    this.titleElement.textContent = this.groupElement.name;
    this.#updateDaysElement();
  }

  #updateDaysElement() {
    this.daysElement.days = this.groupElement.days.map(day => ({
      day,
      callback: () => {
        this.currentDay = day
        this.daysElement.currentDay = day;
      }
    }))
    this.daysElement.currentDay = this.currentDay;
  }

  #createTitleElement() {
    this.titleElement = document.createElement("h2");
    return this.titleElement;
  }

  #createDayScheduleElement() {
    this.dayScheduleElement = document.createElement("table", { is: DayScheduleTableElement.customComponentTagName });
    return this.dayScheduleElement;
  }

  #createPanelElement() {
    this.panelElement = document.createElement("div");
    this.panelElement.classList.add("panel");
    this.panelElement.appendChild(this.#createWeekParityToggleElement());
    this.panelElement.appendChild(this.#createDaysElement());
    return this.panelElement;
  }

  #createDaysElement() {
    this.daysElement = document.createElement(DaysElement.tagName);
    return this.daysElement;
  }

  #createWeekParityToggleElement() {
    this.weekParityToggleElement = document.createElement("button");
    this.weekParityToggleElement.classList.add("weekParityToggle");
    this.weekParityToggleElement.onclick = () => this.currentWeekParity = this.currentWeekParity === 1 ? 2 : 1;
    return this.weekParityToggleElement;
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
    this.dayScheduleElement.schedule = this.groupElement.getDaySchedule(currentDay);
    this.#currentDay = currentDay;
  }

  static get tagName() {
    return "schedule-group";
  }
}

class DaysElement extends HTMLElement {
  set days(days) {
    this.daysElements = {};
    for (const day of days) {
      this.appendChild(this.#createDayButton(day));
    }
  }

  set currentDay(day) {
    const previousActiveDay = this.querySelector(".day_active");

    if (previousActiveDay !== null) {
      previousActiveDay.classList.remove("day_active");
    }

    this.daysElements[day].classList.add("day_active");
  }

  #createDayButton({ day, callback }) {
    const dayElement = document.createElement("button")
    dayElement.classList.add("day");
    dayElement.textContent = daysShortenings[day];
    dayElement.onclick = callback;
    this.daysElements[day] = dayElement;
    return dayElement;
  }

  static get tagName() {
    return "schedule-days";
  }
}

class DayScheduleTableElement extends HTMLTableElement {
  #parity = 1;

  constructor() {
    super();

    this.resizeObserver = this.#createResizeObserver();

    this.body = this.#createBody();

    this.classList.add("scheduleDayTable");
  }

  #createResizeObserver() {
    const resizeObserver = new ResizeObserver(() => this.#updateResizableObjects());
    resizeObserver.observe(this);
    return resizeObserver;
  }

  #createBody() {
    const body = document.createElement("tbody");
    this.appendChild(body);
    return body;
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

    const rowKey = Object.keys(this.rowElements)[0];
    for (const lesson of lessons) {
      lesson.style.height = `${this.rowElements[rowKey].clientHeight * 12}px`;
    }
  }

  #updateTimePosition() {
    const timeElements = this.querySelectorAll(".timeRow:not(:first-child) .time")

    const rowKey = Object.keys(this.rowElements)[0];
    for (const timeElement of timeElements) {
      timeElement.style.top = `${-5 - this.rowElements[rowKey].clientHeight}px`
    }
  }

  #updateSchedule() {
    const weekLessons = this.parity === 1 ? this.scheduleObject.oddWeek : this.scheduleObject.evenWeek;
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
      this.body.appendChild(this.#createRow(currentTime.toString()));
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

  #createRow(time) {
    const row = document.createElement("tr", { is: DayScheduleTableRowElement.customComponentTagName })
    this.rowElements[time] = row;
    this.body.appendChild(row);
    return row;
  }

  static get customComponentTagName() {
    return "schedule-day-table";
  }
}

class DayScheduleTableRowElement extends HTMLTableRowElement {
  constructor() {
    super();

    this.appendChild(this.#createTimeColumn());
    this.appendChild(this.#createScheduleColumn());

    this.classList.add("timeRow");
  }

  #createTimeColumn() {
    this.timeColumn = document.createElement("td");
    this.timeColumn.classList.add("timeColumn");
    return this.timeColumn;
  }

  #createScheduleColumn() {
    this.scheduleColumn = document.createElement("td");
    this.scheduleColumn.classList.add("scheduleColumn");
    return this.scheduleColumn;
  }

  set lesson(lesson) {
    this.lessonElement = document.createElement(LessonElement.customComponentTagName);
    this.lessonElement.lesson = lesson;
    this.scheduleColumn.appendChild(this.lessonElement);
  }

  set dateTimeString(dateTimeString) {
    const timeElement = document.createElement("span");
    timeElement.classList.add("time");
    timeElement.textContent = dateTimeString;
    this.timeColumn.appendChild(timeElement);
  }

  static get customComponentTagName() {
    return "schedule-day-tr";
  }
}

class LessonElement extends HTMLElement {
  connectedCallback() {
    this.appendChild(this.#createTimeAndClassRoomElement());
    this.appendChild(this.#createDisciplineElement());
    this.appendChild(this.#createLecturersElement());
  }

  #createTimeAndClassRoomElement() {
    this.timeAndClassRoomElement = document.createElement("div");
    this.timeAndClassRoomElement.appendChild(this.#createTimeElement());
    this.timeAndClassRoomElement.appendChild(this.#createClassRoomElement());
    return this.timeAndClassRoomElement;
  }

  #createTimeElement() {
    this.timeElement = document.createElement("div");
    this.timeElement.textContent = `${this.lessonObject.time} - ${Time.parse(this.lessonObject.time).getPlusHoursAndMinutesTime(1, 30)}`;
    return this.timeElement;
  }

  #createDisciplineElement() {
    this.disciplineElement = document.createElement("div");
    this.disciplineElement.textContent = this.lessonObject.discipline;
    return this.disciplineElement;
  }

  #createClassRoomElement() {
    this.classRoomElement = document.createElement("div");
    this.classRoomElement.textContent = this.lessonObject.classRoom;
    return this.classRoomElement;
  }

  #createLecturersElement() {
    this.lecturersElement = document.createElement("div");
    this.lecturersElement.textContent = this.lessonObject.lecturers.join(", ");
    return this.lecturersElement;
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
    }
    else {
      return '0' + numberString;
    }
  }

  getTimeWithMinutes(minutes) {
    if (minutes >= 60) {
      return Time.fromTime(this.getHours() * 60);
    }
    else {
      return Time.fromTime(this.getHours() * 60 + minutes);
    }
  }

  getHours() {
    return Math.trunc(this.#minutes / 60);
  }

  getTimeWithHours(hours) {
    if (hours >= 24) {
      return Time.fromTime(0);
    }
    else {
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
    }
    else if (minutes < 0) {
      return 0;
    }
    else {
      return minutes;
    }
  }
}

class Schedule {
  constructor(xmlDocument) {
    this.xmlDocument = xmlDocument;
  }

  get groups() {
    const groupElements = this.xmlDocument.querySelectorAll("Group");
    const groups = [];

    for (const groupElement of groupElements) {
      groups.push(new GroupSchedule(groupElement));
    }

    return groups;
  }

  getGroupByNumber(number) {
    const xmlNode = this.xmlDocument.querySelector(`Group[Number='${number}']`);
    return new GroupSchedule(xmlNode);
  }
}

class GroupSchedule {
  constructor(group) {
    this.group = group;
  }

  get name() {
    return this.group.getAttribute("Number");
  }

  get daysShortenings() {
    const dayNames = this.days;
    const shortenings = [];
    for (const day of dayNames) {
      shortenings.push(this.#getDayShortening(day))
    }
    return shortenings;
  }

  #getDayShortening(day) {
    if (daysShortenings[day] !== undefined) {
      return daysShortenings[day];
    }
    else {
      throw new Error(`Не удалось найти сокращение для дня: ${day}`);
    }
  }

  get days() {
    const dayElements = this.group.querySelectorAll("Day");
    const dayNames = [];
    for (const dayElement of dayElements) {
      dayNames.push(dayElement.getAttribute("Title"));
    }
    return dayNames;
  }

  getDaySchedule(dayName) {
    return new DaySchedule(this.group.querySelector(`Day[Title=${dayName}]`));
  }
}

class DaySchedule {
  constructor(day) {
    this.day = day;
  }

  get evenWeek() {
    const schedule = [];
    for (const lesson of this.#evenLessons) {
      schedule.push(this.#parseLessonXML(lesson));
    }
    return schedule;
  }

  get #evenLessons() {
    return this.#lessons.filter(lesson => lesson.querySelector("WeekCode").textContent === "2");
  }

  get oddWeek() {
    const schedule = [];
    for (const lesson of this.#oddLessons) {
      schedule.push(this.#parseLessonXML(lesson));
    }
    return schedule;
  }

  get #oddLessons() {
    return this.#lessons.filter(lesson => lesson.querySelector("WeekCode").textContent === "1");
  }

  get #lessons() {
    return [...this.day.querySelectorAll("Lesson")];
  }

  #parseLessonXML(lesson) {
    return {
      time: this.#parseLessonTime(lesson),
      discipline: lesson.querySelector("Discipline").textContent,
      lecturers: this.#parseLecturers(lesson),
      classRoom: lesson.querySelector("Classroom").textContent
    };
  }

  #parseLessonTime(lesson) {
    const timeElement = lesson.querySelector("Time");
    return timeElement.textContent.split(" ")[0];
  }

  #parseLecturers(lesson) {
    const lecturers = [];
    const lecturerElements = lesson.querySelectorAll("Lecturer");
    for (const lecturerElement of lecturerElements) {
      lecturers.push(lecturerElement.querySelector("ShortName").textContent)
    }
    return lecturers;
  }
}

customElements.define(NavigatorElement.tagName, NavigatorElement);
customElements.define(GroupsListElement.tagName, GroupsListElement);
customElements.define(GroupListItemElement.tagName, GroupListItemElement);
customElements.define(GroupElement.tagName, GroupElement);
customElements.define(DaysElement.tagName, DaysElement);
customElements.define(DayScheduleTableElement.customComponentTagName, DayScheduleTableElement, { extends: "table" });
customElements.define(DayScheduleTableRowElement.customComponentTagName, DayScheduleTableRowElement, { extends: "tr" });
customElements.define(LessonElement.customComponentTagName, LessonElement);

const navigatorElement = document.createElement(NavigatorElement.tagName);

bodyElement.appendChild(navigatorElement);

async function tryGetSchedule() {
  const xmlString = await tryFetchScheduleXML();
  const xmlDocument = domParser.parseFromString(xmlString, "text/xml");
  return new Schedule(xmlDocument);
}

function tryFetchScheduleXML() {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();

    request.open(
      "GET",
      "https://cors-proxy.cluster.fun/https://www.voenmeh.ru/templates/jd_atlanta/js/TimetableGroup46.xml"
    );

    request.send();

    request.onload = () => {
      if (request.status !== 200) {
        reject(
          `Не удалось получить расписание с сайта военмеха. Код ошибки: ${request.status}`
        );
      } else {
        resolve(request.response);
      }
    };
  });
}
