from .base import BaseErrorCode


# Education module related return error code, function module code: 112

class CourseNotFoundError(BaseErrorCode):
    Code: int = 11200
    Msg: str = 'Course does not exist'


class ChapterNotFoundError(BaseErrorCode):
    Code: int = 11201
    Msg: str = 'Chapter does not exist'


class VideoNotFoundError(BaseErrorCode):
    Code: int = 11202
    Msg: str = 'Video does not exist'


class ProgressUpdateError(BaseErrorCode):
    Code: int = 11210
    Msg: str = 'Failed to update learning progress'


class ChapterCompleteError(BaseErrorCode):
    Code: int = 11211
    Msg: str = 'Failed to mark chapter as complete'


class GuidedStepNotFoundError(BaseErrorCode):
    Code: int = 11220
    Msg: str = 'Guided builder step does not exist'


class GuidedProgressSaveError(BaseErrorCode):
    Code: int = 11221
    Msg: str = 'Failed to save guided builder progress'


class CourseStatsError(BaseErrorCode):
    Code: int = 11230
    Msg: str = 'Failed to retrieve course statistics'
