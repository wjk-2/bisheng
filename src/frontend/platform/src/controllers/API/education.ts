import axios from "../request";

// 教育模块 API 基础路径（v2.3.0 规范：/api/v1/education）
const EDUCATION_API_BASE = '/api/v1/education';

// 课程相关 API
export const courseAPI = {
  // 获取课程列表
  getCourses: async (params?: {
    level?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params?.level && params.level !== 'all') {
      queryParams.append('level', params.level);
    }
    if (params?.category && params.category !== 'all') {
      queryParams.append('category', params.category);
    }
    if (params?.page) {
      queryParams.append('page', params.page.toString());
    }
    if (params?.pageSize) {
      queryParams.append('pageSize', params.pageSize.toString());
    }

    const queryString = queryParams.toString();
    const url = `${EDUCATION_API_BASE}/courses${queryString ? `?${queryString}` : ''}`;

    return await axios.get(url);
  },

  // 获取课程详情
  getCourseDetail: async (courseId: string) => {
    return await axios.get(`${EDUCATION_API_BASE}/courses/${courseId}`);
  },
};

// 学习进度相关 API
export const progressAPI = {
  // 获取用户学习进度
  getUserProgress: async () => {
    return await axios.get(`${EDUCATION_API_BASE}/progress`);
  },

  // 获取课程进度详情
  getCourseProgress: async (courseId: string) => {
    return await axios.get(`${EDUCATION_API_BASE}/progress/courses/${courseId}`);
  },

  // 标记章节完成
  completeChapter: async (chapterId: string) => {
    return await axios.post(`${EDUCATION_API_BASE}/progress/chapters/${chapterId}/complete`);
  },
};

// 视频相关 API
export const videoAPI = {
  // 获取视频播放信息
  getVideoInfo: async (chapterId: string) => {
    return await axios.get(`${EDUCATION_API_BASE}/videos/${chapterId}`);
  },

  // 更新观看进度
  updateProgress: async (chapterId: string, data: {
    position: number;
    completed: boolean;
  }) => {
    return await axios.post(`${EDUCATION_API_BASE}/videos/${chapterId}/progress`, data);
  },
};

// 引导式构建相关 API
export const guidedBuilderAPI = {
  // 获取引导步骤
  getSteps: async () => {
    return await axios.get(`${EDUCATION_API_BASE}/guided-builder/steps`);
  },

  // 保存引导进度
  saveProgress: async (data: {
    step_id: string;
    completed: boolean;
    config_data?: any;
  }) => {
    return await axios.post(`${EDUCATION_API_BASE}/guided-builder/progress`, data);
  },

  // 获取用户引导进度
  getUserProgress: async () => {
    return await axios.get(`${EDUCATION_API_BASE}/guided-builder/progress/summary`);
  },
};

// 统计相关 API
export const statsAPI = {
  // 获取学习统计数据
  getLearningStats: async () => {
    return await axios.get(`${EDUCATION_API_BASE}/stats/overview`);
  },
};

// 导出教育模块 API
export const educationAPI = {
  course: courseAPI,
  progress: progressAPI,
  video: videoAPI,
  guidedBuilder: guidedBuilderAPI,
  stats: statsAPI,
};

export default educationAPI;
