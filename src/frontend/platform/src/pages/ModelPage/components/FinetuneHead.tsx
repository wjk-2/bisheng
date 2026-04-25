import { useToast } from "@/components/bs-ui/toast/use-toast";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../../components/bs-ui/button";
import { SearchInput } from "../../../components/bs-ui/input";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "../../../components/bs-ui/select";
import { ToggleGroup, ToggleGroupItem } from "../../../components/bs-ui/toggle-group";
import { getAllServicesApi } from "../../../controllers/API";
import { useDebounce } from "../../../util/hook";

interface IProps {
    onSearch: (searchkey) => void,
    onFilter: ({ type, rt }) => void,
    rtClick: () => void,
    onCreate: () => void,
    isAdmin?: boolean,
}
export default function FinetuneHead({ onSearch, onFilter, rtClick, onCreate, isAdmin = false }: IProps) {
    const { t } = useTranslation('model')
    const { message } = useToast();

    const [type, setType] = useState('all')
    const [rt, setRt] = useState('all')
    const inputRef = useRef(null)

    const handleTypeChange = (val) => {
        setType(val)
        onFilter({ type: val, rt })
    }

    const handleRtChange = (val) => {
        setRt(val)
        onFilter({ type, rt: val })
    }

    // 权限不足提示
    const showPermissionDenied = () => {
        message({ variant: 'warning', description: '暂无权限，请联系管理员' });
    };

    // rts
    const [services, setServices] = useState([])
    useEffect(() => {
        getAllServicesApi().then(res => {
            setServices(res.map(el => ({
                id: el.id,
                name: el.server_name
            })))
        })

        onFilter({ type, rt })
    }, [])

    const handleSearch = () => {
        onSearch(inputRef.current.value)
    }

    return <div className="flex justify-between pb-4 border-b mx-4">
        <div className="flex gap-4">
            <ToggleGroup type="single" defaultValue={type} onValueChange={handleTypeChange} className="border rounded-md">
                <ToggleGroupItem value="all">{t('finetune.all')}</ToggleGroupItem>
                <ToggleGroupItem value="4">{t('finetune.successful')}</ToggleGroupItem>
                <ToggleGroupItem value="1">{t('finetune.inProgress')}</ToggleGroupItem>
                <ToggleGroupItem value="2">{t('finetune.failed')}</ToggleGroupItem>
                <ToggleGroupItem value="3">{t('finetune.canceled')}</ToggleGroupItem>
            </ToggleGroup>
            <Select defaultValue={rt} onValueChange={handleRtChange}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectItem value="all">{t('finetune.allRTServices')}</SelectItem>
                        {services.map(el => <SelectItem key={el.id} value={String(el.id)}>{el.name}</SelectItem>)}
                    </SelectGroup>
                </SelectContent>
            </Select>
            <SearchInput ref={inputRef} placeholder={t('finetune.searchModelName')} onSearch={handleSearch} />
        </div>
        <div className="flex gap-4">
            <Button variant="outline" onClick={rtClick}>{t('finetune.rtServiceManagement')}</Button>
            <Button onClick={() => isAdmin ? onCreate() : showPermissionDenied()}>{t('finetune.createTrainingTask')}</Button>
        </div>
    </div>
}
