import { createElement } from 'react';
import focusGuardianSvg from './assets/icons/focus-guardian.svg';
import {
  MdAccessTime,
  MdAccountTree,
  MdAdd,
  MdArrowBack,
  MdArrowDownward,
  MdArrowForward,
  MdArrowOutward,
  MdAssignment,
  MdBusiness,
  MdBusinessCenter,
  MdCalendarMonth,
  MdCancel,
  MdChat,
  MdCheck,
  MdCheckBox,
  MdCheckCircle,
  MdChecklist,
  MdChevronRight,
  MdClose,
  MdCompareArrows,
  MdContentPaste,
  MdDashboard,
  MdDelete,
  MdDescription,
  MdDownload,
  MdEdit,
  MdError,
  MdEvent,
  MdEventAvailable,
  MdExpandLess,
  MdExpandMore,
  MdFactCheck,
  MdFavorite,
  MdFilterList,
  MdFormatQuote,
  MdGppMaybe,
  MdGpsFixed,
  MdGroup,
  MdGroups,
  MdHelp,
  MdHistory,
  MdHowToReg,
  MdHub,
  MdInbox,
  MdInfo,
  MdInsights,
  MdKey,
  MdLayers,
  MdLink,
  MdList,
  MdLock,
  MdLogout,
  MdMail,
  MdMenu,
  MdMessage,
  MdNotifications,
  MdPalette,
  MdPerson,
  MdPersonAdd,
  MdPlayCircle,
  MdPowerSettingsNew,
  MdRefresh,
  MdRemove,
  MdReportProblem,
  MdSave,
  MdSchedule,
  MdSearch,
  MdSend,
  MdSettings,
  MdSpeed,
  MdTimer,
  MdTune,
  MdVerifiedUser,
  MdViewKanban,
  MdViewTimeline,
  MdVisibility,
  MdVisibilityOff,
  MdWarningAmber,
  MdWorkspacePremium,
} from 'react-icons/md';
import {
  LuActivity,
  LuArrowDownRight,
  LuArrowLeftRight,
  LuArrowRight,
  LuArrowUpRight,
  LuBadgeCheck,
  LuBan,
  LuBell,
  LuBuilding2,
  LuCalendarCheck,
  LuCalendarClock,
  LuCalendarDays,
  LuChartColumn,
  LuChartNoAxesCombined,
  LuCheck,
  LuCheckCheck,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuCircle,
  LuCircleAlert,
  LuCircleCheck,
  LuCircleDot,
  LuCircleHelp,
  LuCirclePlay,
  LuClipboardCheck,
  LuClipboardList,
  LuClock,
  LuClock3,
  LuColumns3,
  LuCompass,
  LuCrosshair,
  LuDatabase,
  LuEye,
  LuFileCheck2,
  LuFileQuestion,
  LuFileSearch,
  LuFlag,
  LuFolderKanban,
  LuGauge,
  LuHandHeart,
  LuHardDrive,
  LuHistory,
  LuHouse,
  LuInfo,
  LuKeyRound,
  LuLayers3,
  LuLayoutDashboard,
  LuLink2,
  LuListChecks,
  LuListTodo,
  LuLoaderCircle,
  LuLock,
  LuLockKeyhole,
  LuLogOut,
  LuMail,
  LuMenu,
  LuMessageSquareText,
  LuMoon,
  LuMoveUpRight,
  LuOctagonAlert,
  LuPencil,
  LuRefreshCw,
  LuRoute,
  LuSearch,
  LuSend,
  LuSettings,
  LuShieldAlert,
  LuShieldCheck,
  LuShieldQuestion,
  LuSlidersHorizontal,
  LuSparkles,
  LuSun,
  LuTable2,
  LuTarget,
  LuTimer,
  LuTriangleAlert,
  LuUserCheck,
  LuUserRound,
  LuUserRoundCheck,
  LuUsers,
  LuUsersRound,
  LuWandSparkles,
  LuWorkflow,
  LuX,
  LuZap,
} from 'react-icons/lu';

export const IconActivity = MdInsights;
export const IconAlertCircle = MdError;
export const IconAlertOctagon = MdReportProblem;
export const IconAlertTriangle = MdWarningAmber;
export const IconArrowDownRight = MdArrowDownward;
export const IconArrowLeft = MdArrowBack;
export const IconArrowRight = MdArrowForward;
export const IconArrowUpRight = MdArrowOutward;
export const IconBell = MdNotifications;
export const IconBriefcaseBusiness = MdBusinessCenter;
export const IconBuilding2 = MdBusiness;
export const IconCalendar = MdCalendarMonth;
export const IconCalendarCheck = MdEventAvailable;
export const IconCalendarClock = MdEvent;
export const IconCalendarDays = MdCalendarMonth;
export const IconChartNoAxesCombined = MdInsights;
export const IconCheck = MdCheck;
export const IconCheckCircle2 = MdCheckCircle;
export const IconCheckSquare = MdCheckBox;
export const IconChevronDown = MdExpandMore;
export const IconChevronRight = MdChevronRight;
export const IconCircleAlert = MdError;
export const IconCircleCheck = MdCheckCircle;
export const IconCircleHelp = MdHelp;
export const IconClipboard = MdContentPaste;
export const IconClipboardCheck = MdFactCheck;
export const IconClipboardList = MdAssignment;
export const IconClock = MdAccessTime;
export const IconClock3 = MdSchedule;
export const IconCrown = MdWorkspacePremium;
export const IconDownload = MdDownload;
export const IconEdit3 = MdEdit;
export const IconError = MdError;
export const IconEye = MdVisibility;
export const IconEyeOff = MdVisibilityOff;
export const IconFileText = MdDescription;
export const IconFilter = MdFilterList;
export const IconFolderKanban = MdViewKanban;
export const IconGanttChartSquare = MdViewTimeline;
export const IconGauge = MdSpeed;
export const IconGitCompareArrows = MdCompareArrows;
export const IconHeart = MdFavorite;
export const IconHelpCircle = MdHelp;
export const IconHistory = MdHistory;
export const IconInbox = MdInbox;
export const IconInfo = MdInfo;
export const IconKanban = MdViewKanban;
export const IconKey = MdKey;
export const IconKeyRound = MdKey;
export const IconLayers = MdLayers;
export const IconLayoutDashboard = MdDashboard;
export const IconLink2 = MdLink;
export const IconList = MdList;
export const IconListChecks = MdChecklist;
export const IconLockKeyhole = MdLock;
export const IconLogOut = MdLogout;
export const IconMail = MdMail;
export const IconMenu = MdMenu;
export const IconMessageSquare = MdMessage;
export const IconMessageSquareText = MdChat;
export const IconMinus = MdRemove;
export const IconNetwork = MdHub;
export const IconPalette = MdPalette;
export const IconPencil = MdEdit;
export const IconPlayCircle = MdPlayCircle;
export const IconPlus = MdAdd;
export const IconPower = MdPowerSettingsNew;
export const IconQuote = MdFormatQuote;
export const IconRefresh = MdRefresh;
export const IconSave = MdSave;
export const IconSearch = MdSearch;
export const IconSend = MdSend;
export const IconSettings = MdSettings;
export const IconSettings2 = MdTune;
export const IconShieldAlert = MdGppMaybe;
export const IconShieldCheck = MdVerifiedUser;
export const IconTarget = MdGpsFixed;
export const IconTimer = MdTimer;
export const IconTrash2 = MdDelete;
export const IconUserCheck = MdHowToReg;
export const IconUserPlus = MdPersonAdd;
export const IconUserRound = MdPerson;
export const IconUsers = MdGroup;
export const IconUsersRound = MdGroups;
export const IconWorkflow = MdAccountTree;
export const IconX = MdClose;
export const IconXCircle = MdCancel;

// Admin navigation icons
export const IconAdminNavActivity = LuActivity;
export const IconAdminNavBarChart3 = LuChartColumn;
export const IconAdminNavBuilding2 = LuBuilding2;
export const IconAdminNavKeyRound = LuKeyRound;
export const IconAdminNavLayoutDashboard = LuLayoutDashboard;
export const IconAdminNavMail = LuMail;
export const IconAdminNavSettings = LuSettings;
export const IconAdminNavUserCheck = LuUserCheck;
export const IconAdminNavUsersRound = LuUsersRound;
// Analytics icons
export const IconAnalyticsAlertCircle = LuCircleAlert;
export const IconAnalyticsAlertTriangle = LuTriangleAlert;
export const IconAnalyticsCalendarClock = LuCalendarClock;
export const IconAnalyticsCheckCircle2 = LuCircleCheck;
export const IconAnalyticsCircle = LuCircle;
export const IconAnalyticsRefreshCw = LuRefreshCw;
export const IconAnalyticsTable2 = LuTable2;
// Dashboard icons
export const IconDashboardArrowUpRight = LuArrowUpRight;
export const IconDashboardBell = LuBell;
export const IconDashboardCheck = LuCheck;
export const IconDashboardCheckCheck = LuCheckCheck;
export const IconDashboardChevronDown = LuChevronDown;
export const IconDashboardFolderKanban = LuFolderKanban;
export const IconDashboardLayers3 = LuLayers3;
export const IconDashboardLogOut = LuLogOut;
export const IconDashboardMenu = LuMenu;
// Landing page icons
export const IconLandingActivity = LuActivity;
export const IconLandingAlertTriangle = LuTriangleAlert;
export const IconLandingArrowDownRight = LuArrowDownRight;
export const IconLandingArrowRight = LuArrowRight;
export const IconLandingCalendarDays = LuCalendarDays;
export const IconLandingChartNoAxesCombined = LuChartNoAxesCombined;
export const IconLandingCheckCircle2 = LuCircleCheck;
export const IconLandingChevronDown = LuChevronDown;
export const IconLandingCircleHelp = LuCircleHelp;
export const IconLandingClipboardCheck = LuClipboardCheck;
export const IconLandingClock3 = LuClock3;
export const IconLandingCompass = LuCompass;
export const IconLandingDatabase = LuDatabase;
export const IconLandingFeatureRecovery = LuClipboardCheck;
export const IconLandingFolderKanban = LuFolderKanban;
export const IconLandingGauge = LuGauge;
export const IconLandingLayers3 = LuLayers3;
export const IconLandingLockKeyhole = LuLockKeyhole;
export const IconLandingMoveUpRight = LuMoveUpRight;
export const IconLandingShieldCheck = LuShieldCheck;
export const IconLandingUsers = LuUsers;
export const IconLandingWorkflow = LuWorkflow;
export const IconLandingWorkflowRecovery = LuWandSparkles;
export const IconLandingZap = LuZap;
// Manager view icons
export const IconManagerActivity = MdInsights;
export const IconManagerAlertOctagon = MdReportProblem;
export const IconManagerAlertTriangle = MdWarningAmber;
export const IconManagerArrowRight = MdArrowForward;
export const IconManagerArrowUpRight = MdArrowOutward;
export const IconManagerBuilding2 = MdBusiness;
export const IconManagerCalendar = MdEvent;
export const IconManagerCalendarDays = MdCalendarMonth;
export const IconManagerCheckCircle2 = MdCheckCircle;
export const IconManagerCheckSquare = MdCheckBox;
export const IconManagerChevronDown = MdExpandMore;
export const IconManagerChevronUp = MdExpandLess;
export const IconManagerCircleAlert = MdError;
export const IconManagerClipboardCheck = MdFactCheck;
export const IconManagerClock = MdAccessTime;
export const IconManagerFileText = MdDescription;
export const IconManagerFolderKanban = MdViewKanban;
export const IconManagerHelpCircle = MdHelp;
export const IconManagerHistory = MdHistory;
export const IconManagerMessageSquareText = MdMessage;
export const IconManagerRefreshCw = MdRefresh;
export const IconManagerRun = MdPlayCircle;
export const IconManagerSearch = MdSearch;
export const IconManagerShieldCheck = MdVerifiedUser;
export const IconManagerUser = MdPerson;
export const IconManagerUsersRound = MdGroups;
// Sidebar icons
export const IconSidebarActivityHistory = LuHistory;
export const IconSidebarAdminTransfer = LuArrowLeftRight;
export const IconSidebarArrowLeftRight = LuArrowLeftRight;
export const IconSidebarArrowUpRight = LuArrowUpRight;
export const IconSidebarBuilding2 = LuBuilding2;
export const IconSidebarCheck = LuCheck;
export const IconSidebarChevronLeft = LuChevronLeft;
export const IconSidebarChevronRight = LuChevronRight;
export const IconSidebarCircleHelp = LuCircleHelp;
export const IconSidebarCompass = LuCompass;
export const IconSidebarEmployeeAgenda = LuCrosshair;
export const IconSidebarEmployeeLeave = LuCalendarCheck;
export const IconSidebarEmployeeTasks = LuListChecks;
export const IconSidebarEmployeeUpdates = LuMessageSquareText;
export const IconSidebarEmployeeWorkLogs = LuTimer;
export const IconSidebarLogOut = LuLogOut;
export const IconSidebarManagerAgenda = LuTarget;
export const IconSidebarManagerLeave = LuCalendarDays;
export const IconSidebarManagerTasks = LuListTodo;
export const IconSidebarManagerUpdates = LuSend;
export const IconSidebarManagerWorkLogs = LuClock3;
export const IconSidebarMoon = LuMoon;
export const IconSidebarMyOverview = LuHouse;
export const IconSidebarOverview = LuLayoutDashboard;
export const IconSidebarProjects = LuFolderKanban;
export const IconSidebarRecoveryPlans = LuClipboardCheck;
export const IconSidebarSettings = LuSettings;
export const IconSidebarSun = LuSun;
export const IconSidebarTaskBoard = LuColumns3;
export const IconSidebarTeamCapacity = LuUsersRound;
export const IconSidebarUserRound = LuUserRound;
export const IconSidebarUsersRound = LuUsersRound;
export const IconSidebarX = LuX;
// Landing section icons
export const IconLandingWorkflowEvidence = LuFileSearch;
export const IconLandingChallengeVisibility = LuLayers3;
export const IconLandingChallengeBlockers = LuOctagonAlert;
export const IconLandingChallengePlanning = LuRoute;
export const IconLandingTrustAccess = LuLockKeyhole;
export const IconLandingTrustValidation = LuFileCheck2;
export const IconLandingTrustApproval = LuUserRoundCheck;
export const IconLandingTrustSignals = LuEye;
export const IconLandingTrustDataQuality = LuFileQuestion;
export const IconLandingTrustWorkflows = LuWorkflow;
export const IconLandingPreviewRisk = LuCircleAlert;
export const IconLandingPreviewRecovery = LuClipboardList;
export const IconLandingPreviewSignal = LuSparkles;
export const IconLandingPreviewSignalReady = LuCircleDot;
export const IconLandingHeroEvidence = LuShieldCheck;
export const IconLandingHeroApproval = LuBadgeCheck;
export const IconLandingTrustDesign = LuShieldQuestion;
export const IconLandingTrustPeople = LuHandHeart;
export const IconLandingTrustData = LuHardDrive;
export const IconLandingDemoApproval = LuCircleCheck;
export const IconLandingExampleRisk = LuShieldAlert;
export const IconLandingExampleRecovery = LuFileCheck2;
export const IconSpinner = LuLoaderCircle;
// Task icons
export const IconTasksAlertCircle = LuCircleAlert;
export const IconTasksAlertOctagon = LuOctagonAlert;
export const IconTasksAlertTriangle = LuTriangleAlert;
export const IconTasksBan = LuBan;
export const IconTasksCalendarDays = LuCalendarDays;
export const IconTasksCheck = LuCheck;
export const IconTasksCheckCircle2 = LuCircleCheck;
export const IconTasksChevronDown = LuChevronDown;
export const IconTasksChevronLeft = LuChevronLeft;
export const IconTasksChevronRight = LuChevronRight;
export const IconTasksCircle = LuCircle;
export const IconTasksCircleDot = LuCircleDot;
export const IconTasksClock = LuClock;
export const IconTasksEdit2 = LuPencil;
export const IconTasksFlag = LuFlag;
export const IconTasksInfo = LuInfo;
export const IconTasksLink2 = LuLink2;
export const IconTasksLock = LuLock;
export const IconTasksPlayCircle = LuCirclePlay;
export const IconTasksSearch = LuSearch;
export const IconTasksSlidersHorizontal = LuSlidersHorizontal;

export const IconFocusGuardian = ({ className }: { className?: string }) => createElement('img', { src: focusGuardianSvg, className, alt: '', 'aria-hidden': true });
export type { IconType } from 'react-icons';
