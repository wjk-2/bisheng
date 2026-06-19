from .base import BaseErrorCode


# RTService-related return error code, function module code:100
class NoSftServerError(BaseErrorCode):
    Code: int = 10001
    Msg: str = 'not foundSFTSERVICES'


# Invalid nonce
class InvalidOperationError(BaseErrorCode):
    Code: int = 10002
    Msg: str = 'Invalid nonce'


# Resource download failed
class ResourceDownloadError(BaseErrorCode):
    Code: int = 10003
    Msg: str = 'Resource download failed'


# Knowledge Base Not Configuredembeddingmodel, please set from workbench configuration
class NoEmbeddingModelError(BaseErrorCode):
    Code: int = 10004
    Msg: str = 'Knowledge Base Not Configuredembeddingmodel, please set from workbench configuration'


# The knowledge base uponembeddingModel does not exist, please set from workbench configuration
class EmbeddingModelNotExistError(BaseErrorCode):
    Code: int = 10005
    Msg: str = 'The knowledge base uponembeddingModel does not exist, please set from workbench configuration'


# The knowledge base uponembeddingWrong model type, please set from workbench configuration
class EmbeddingModelTypeError(BaseErrorCode):
    Code: int = 10006
    Msg: str = 'The knowledge base uponembeddingWrong model type, please set from workbench configuration'


# Please contact the administrator to check the status of the workbench vector retrieval model
class EmbeddingModelStatusError(BaseErrorCode):
    Code: int = 10007
    Msg: str = 'Please contact the administrator to check the status of the workbench vector retrieval model'


# No bulkpost found in Trashllmmodel config
class NoLlmModelConfigError(BaseErrorCode):
    Code: int = 10008
    Msg: str = 'No bulkpost found in Trashllmmodel config'


# llmModel configuration has been deleted, please reconfigure the model
class LlmModelConfigDeletedError(BaseErrorCode):
    Code: int = 10009
    Msg: str = 'llmModel configuration has been deleted, please reconfigure the model'


# Service provider configuration has been deleted, please reconfigurellmModels
class LlmProviderDeletedError(BaseErrorCode):
    Code: int = 10010
    Msg: str = 'Service provider configuration has been deleted, please reconfigurellmModels'


# Support onlyLLMModel of type, not supported{model_info.model_type}Type of model
class LlmModelTypeError(BaseErrorCode):
    Code: int = 10011
    Msg: str = 'Support onlyLLMModel of type, not supported{model_type}Type of model'


# {server_info.name}under{model_info.model_name}The model is offline, please contact the administrator to launch the corresponding model
class LlmModelOfflineError(BaseErrorCode):
    Code: int = 10012
    Msg: str = '{server_name}under{model_name}The model is offline, please contact the administrator to launch the corresponding model'


# InisialisasillmFailed, please check the configuration or contact the administrator.Error message:{e}
class InitLlmError(BaseErrorCode):
    Code: int = 10013
    Msg: str = 'InisialisasillmFailed, please check the configuration or contact the administrator.Error message:{exception}'


class NoAsrModelConfigError(BaseErrorCode):
    Code: int = 10014
    Msg: str = 'No bulkpost found in Trashasrmodel config'


class AsrModelConfigDeletedError(BaseErrorCode):
    Code: int = 10015
    Msg: str = 'asrModel configuration has been deleted, please reconfigure the model'


class AsrProviderDeletedError(BaseErrorCode):
    Code: int = 10016
    Msg: str = 'Service provider configuration has been deleted, please reconfigureasrModels'


class AsrModelTypeError(BaseErrorCode):
    Code: int = 10017
    Msg: str = 'Support onlyASRModel of type, not supported{model_type}Type of model'


class AsrModelOfflineError(BaseErrorCode):
    Code: int = 10018
    Msg: str = '{server_name}under{model_name}The model is offline, please contact the administrator to launch the corresponding model'


class InitAsrError(BaseErrorCode):
    Code: int = 10019
    Msg: str = 'InisialisasiasrFailed, please check the configuration or contact the administrator.Error message:{exception}'


class NoTtsModelConfigError(BaseErrorCode):
    Code: int = 10020
    Msg: str = 'No bulkpost found in Trashttsmodel config'


class TtsModelConfigDeletedError(BaseErrorCode):
    Code: int = 10021
    Msg: str = 'ttsModel configuration has been deleted, please reconfigure the model'


class TtsProviderDeletedError(BaseErrorCode):
    Code: int = 10022
    Msg: str = 'Service provider configuration has been deleted, please reconfigurettsModels'


class TtsModelTypeError(BaseErrorCode):
    Code: int = 10023
    Msg: str = 'Support onlyTTSModel of type, not supported{model_type}Type of model'


class TtsModelOfflineError(BaseErrorCode):
    Code: int = 10024
    Msg: str = '{server_name}under{model_name}The model is offline, please contact the administrator to launch the corresponding model'


class InitTtsError(BaseErrorCode):
    Code: int = 10025
    Msg: str = 'InisialisasittsFailed, please check the configuration or contact the administrator.Error message:{exception}'


class SystemConfigEmptyError(BaseErrorCode):
    Code: int = 10030
    Msg: str = 'System configuration cannot be empty'


class SystemConfigInvalidError(BaseErrorCode):
    Code: int = 10031
    Msg: str = 'The system configuration format is incorrect, please check the configuration content'


# C7: web_config 乐观锁冲突——多 admin 并发写时，传入 version 与 DB 现有 version 不一致。
# 走业务码（HTTP 200 + status_code=10032）与 SystemConfigEmptyError(10030)/Invalid(10031) 同族，
# 不用 HTTP 409 是因为本项目统一用 UnifiedResponseModel 包裹（见 schemas.resp_200/500），
# HTTP 层恒 200，业务状态码在 status_code 字段（前端拦截器按此路由）。
class WebConfigConflictError(BaseErrorCode):
    Code: int = 10032
    Msg: str = 'The theme configuration has been updated by another administrator, please refresh and try again'


class UploadFileEmptyError(BaseErrorCode):
    Code: int = 10040
    Msg: str = 'Uploaded file cannot be empty'


class UploadFileExtError(BaseErrorCode):
    Code: int = 10041
    Msg: str = 'The upload file format is not supported, please upload a file in the correct format'
