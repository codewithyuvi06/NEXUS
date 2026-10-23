import type { Goal, Habit, Note, Project, Task } from './types'

export const initialTasks: Task[] = [
 {id:'t1',title:'Finish React component library',description:'Polish reusable primitives and document variants.',status:'In Progress',priority:'High',dueDate:'2026-10-24',project:'NEXUS',tags:['Development','Portfolio'],subtasks:5,doneSubtasks:3},
 {id:'t2',title:'Review data structures notes',status:'To Do',priority:'High',dueDate:'2026-10-24',project:'College',tags:['Study'],subtasks:4,doneSubtasks:1},
 {id:'t3',title:'Draft weekly reflection',status:'To Do',priority:'Medium',dueDate:'2026-10-24',project:'Personal',tags:['Writing'],subtasks:0,doneSubtasks:0},
 {id:'t4',title:'Plan API service architecture',status:'In Progress',priority:'High',dueDate:'2026-10-25',project:'NEXUS',tags:['Development'],subtasks:3,doneSubtasks:2},
 {id:'t5',title:'Read 20 pages',status:'Completed',priority:'Low',dueDate:'2026-10-22',project:'Personal',tags:['Learning'],subtasks:0,doneSubtasks:0},
 {id:'t6',title:'Update project README',status:'Review',priority:'Medium',dueDate:'2026-10-26',project:'NEXUS',tags:['GitHub'],subtasks:2,doneSubtasks:1},
 {id:'t7',title:'Practice JavaScript closures',status:'To Do',priority:'Medium',dueDate:'2026-10-27',project:'Learning',tags:['Coding'],subtasks:3,doneSubtasks:0},
 {id:'t8',title:'Sketch November goals',status:'Backlog',priority:'Low',dueDate:'2026-10-30',project:'Personal',tags:['Planning'],subtasks:0,doneSubtasks:0},
 {id:'t9',title:'Prepare lab submission',status:'Completed',priority:'High',dueDate:'2026-10-21',project:'College',tags:['College'],subtasks:4,doneSubtasks:4},
 {id:'t10',title:'Explore chart interactions',status:'Backlog',priority:'Low',dueDate:'2026-10-29',project:'NEXUS',tags:['Research'],subtasks:0,doneSubtasks:0},
 {id:'t11',title:'Inbox zero',status:'To Do',priority:'Low',dueDate:'2026-10-25',project:'Personal',tags:['Admin'],subtasks:0,doneSubtasks:0},
 {id:'t12',title:'Write API integration notes',status:'In Progress',priority:'Medium',dueDate:'2026-10-28',project:'NEXUS',tags:['Backend'],subtasks:2,doneSubtasks:1}
]
export const initialProjects: Project[] = [
 {id:'p1',name:'NEXUS',description:'A calm, connected personal productivity workspace.',status:'In progress',progress:62,deadline:'2026-11-15',priority:'High',color:'sage'},
 {id:'p2',name:'CREWVERSE',description:'A private space for the people who matter.',status:'Planning',progress:28,deadline:'2026-12-08',priority:'Medium',color:'gold'},
 {id:'p3',name:'AI Learning Path',description:'Build a practical foundation in machine learning.',status:'In progress',progress:44,deadline:'2027-01-10',priority:'High',color:'blue'},
 {id:'p4',name:'College Semester',description:'Stay ahead of coursework, labs and revision.',status:'Active',progress:71,deadline:'2026-12-20',priority:'Medium',color:'clay'}
]
export const initialGoals: Goal[] = [
 {id:'g1',title:'Become confident with React',category:'Career',progress:68,deadline:'2026-12-01',milestones:5},
 {id:'g2',title:'Maintain a consistent study rhythm',category:'Education',progress:54,deadline:'2026-12-15',milestones:4},
 {id:'g3',title:'Read 12 books this year',category:'Personal',progress:75,deadline:'2026-12-31',milestones:12},
 {id:'g4',title:'Build a portfolio-ready product',category:'Career',progress:42,deadline:'2027-01-15',milestones:6}
]
export const initialHabits: Habit[] = [
 {id:'h1',title:'Morning planning',category:'Mindfulness',streak:8,week:[true,true,true,true,false,true,false]},
 {id:'h2',title:'Deep work session',category:'Career',streak:5,week:[true,true,false,true,true,true,false]},
 {id:'h3',title:'Read for 20 minutes',category:'Learning',streak:12,week:[true,true,true,false,true,true,false]},
 {id:'h4',title:'Practice English',category:'Learning',streak:4,week:[true,false,true,true,true,false,false]},
 {id:'h5',title:'Evening reflection',category:'Mindfulness',streak:3,week:[false,true,true,true,false,true,false]}
]
export const initialNotes: Note[] = [
 {id:'n1',title:'Ideas for NEXUS v1',body:'Keep the interface calm and predictable. Prioritize the everyday workflow over feature density.\\n\\n- Keyboard-first quick capture\\n- Useful empty states\\n- Clear task ownership',category:'Product',tags:['NEXUS','Ideas'],favorite:true,updatedAt:'Today'},
 {id:'n2',title:'React patterns to revisit',body:'Composition over configuration. Keep data fetching and presentation separate. Use small components with clear responsibilities.',category:'Learning',tags:['React','Engineering'],favorite:false,updatedAt:'Yesterday'},
 {id:'n3',title:'Weekly reflection',body:'What worked well this week? What deserves more focus next week? What can be made simpler?',category:'Journal',tags:['Reflection'],favorite:false,updatedAt:'Oct 20'},
 {id:'n4',title:'Project launch checklist',body:'Accessibility pass, responsive testing, loading states, error handling, README, screenshots, deployment notes.',category:'Work',tags:['Checklist'],favorite:true,updatedAt:'Oct 19'}
]
export const weekData = [
 {day:'Mon',tasks:5,focus:2.1},{day:'Tue',tasks:7,focus:3.2},{day:'Wed',tasks:4,focus:1.8},
 {day:'Thu',tasks:8,focus:3.7},{day:'Fri',tasks:6,focus:2.8},{day:'Sat',tasks:3,focus:1.4},{day:'Sun',tasks:5,focus:2.3}
]
