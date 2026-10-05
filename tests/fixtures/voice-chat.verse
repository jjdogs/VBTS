using { /Fortnite.com/Devices }
using { /Verse.org/AgentGroup }
using { /Verse.org/Chat }
using { /Verse.org/Simulation }
    
StM<localizes>(String:string):message="{String}"
voice_chat:=class:
    MyGroup:agent_group(has_voice_member_info)=agent_group(has_voice_member_info){}
    @editable JoinVC : basic_event_handler = trigger_event_handler{}
    @editable LeaveVC : basic_event_handler = trigger_event_handler{}
    @editable MuteAll : basic_event_handler = trigger_event_handler{}
    @editable MutePlayer : basic_event_handler = trigger_event_handler{}
    @editable UnMutePlayer : basic_event_handler = trigger_event_handler{}
    @editable UnMuteAll : basic_event_handler = trigger_event_handler{}
    @editable PlayerStartedSpeaking : basic_signal_handler = trigger_signal_handler{}
    @editable PlayerStoppedSpeaking : basic_signal_handler = trigger_signal_handler{}
    @editable VCName : string = ""
    var VoiceChat:?voice_channel(has_voice_member_info)=false
    Init():void=
        InitializeSubscriptions()
        NewVC:=voice_channel(has_voice_member_info):
            Name:=StM(VCName)
            Group:=MyGroup
        NewVC.BeginBroadcastEvent().Subscribe(OnStartSpeaking)
        NewVC.EndBroadcastEvent().Subscribe(OnStopSpeaking)
        set VoiceChat=option. NewVC

    InitializeSubscriptions():void=
        if:
            Subscribes:=JoinVC.GetSubscribe()
            Subscribes(0)?.Subscribe(OnJoinM) or Subscribes(1)?.Subscribe(OnJoin)
        if:
            Subscribes:=LeaveVC.GetSubscribe()
            Subscribes(0)?.Subscribe(OnLeaveM) or Subscribes(1)?.Subscribe(OnLeave)
        if:
            Subscribes:=MutePlayer.GetSubscribe()
            Subscribes(0)?.Subscribe(OnMuteM) or Subscribes(1)?.Subscribe(OnMute)
        if:
            Subscribes:=UnMutePlayer.GetSubscribe()
            Subscribes(0)?.Subscribe(OnUnmuteM) or Subscribes(1)?.Subscribe(OnUnmute)
        if:
            Subscribes:=MuteAll.GetSubscribe()
            Subscribes(0)?.Subscribe(OnMuteAllM) or Subscribes(1)?.Subscribe(OnMuteAll)
        if:
            Subscribes:=UnMuteAll.GetSubscribe()
            Subscribes(0)?.Subscribe(OnUnmuteAllM) or Subscribes(1)?.Subscribe(OnUnmuteAll)

    OnStartSpeaking(Agent:agent):void=
        PlayerStartedSpeaking.Signal(Agent)

    OnStopSpeaking(Agent:agent):void=
        PlayerStoppedSpeaking.Signal(Agent)
    OnEnable(MAgent:?agent):void=
        if(VoiceChannel:=VoiceChat?):
            VoiceChannel.Enable()
    OnDisable(MAgent:?agent):void=
        if(VoiceChannel:=VoiceChat?):
            VoiceChannel.Disable()

    OnMuteAll(Agent:agent):void=OnMuteAllM(option. Agent)
    OnMuteAllM(MAgent:?agent):void=
        if(VoiceChannel:=VoiceChat?):
            for(AgentsVC:VoiceChannel.Group.GetMemberMap()):
                set AgentsVC.CanBroadcast=false

    OnMute(Agent:agent):void=OnMuteM(option. Agent)
    OnMuteM(MAgent:?agent):void=
        if(VoiceChannel:=VoiceChat?,Agent:=MAgent?):
            if(AgentsVC:=VoiceChannel.Group.GetMemberMap()[Agent]):
                set AgentsVC.CanBroadcast=false

    OnUnmuteAll(Agent:agent):void=OnUnmuteAllM(option. Agent)
    OnUnmuteAllM(MAgent:?agent):void=
        if(VoiceChannel:=VoiceChat?):
            for(AgentsVC:VoiceChannel.Group.GetMemberMap()):
                set AgentsVC.CanBroadcast=true
    OnUnmute(Agent:agent):void=OnUnmuteM(option. Agent)
    OnUnmuteM(MAgent:?agent):void=
        if(VoiceChannel:=VoiceChat?,Agent:=MAgent?):
            if(AgentsVC:=VoiceChannel.Group.GetMemberMap()[Agent]):
                set AgentsVC.CanBroadcast=true

    OnJoin(Agent:agent):void=OnJoinM(option. Agent)
    OnJoinM(MAgent:?agent):void=
        if(Agent:=MAgent?):
            MyGroup.AddMember(Agent,MyMemberInfo{CanBroadcast:=true})

    OnLeave(Agent:agent):void=OnLeaveM(option. Agent)
    OnLeaveM(MAgent:?agent):void=
        if(Agent:=MAgent?):
            MyGroup.RemoveMember(Agent)

voice_chat_manager:=class(creative_device):
    @editable VoiceChats : []voice_chat = array{}
    @editable DeleteDefaultVCsOnGameStart : logic = true
    @editable DebugVCs : trigger_device = trigger_device{}
    OnBegin<override>()<suspends>:void=
        if(DeleteDefaultVCsOnGameStart?,SimEntity:=GetSimulationEntity[]):
            for(VC:SimEntity.GetVoiceChannels()):
                SimEntity.RemoveChatChannel(VC)
        DebugVCs.TriggeredEvent.Subscribe(OnDebug)
        Sleep(0.01)
        for(VC:VoiceChats,SimEntity:=GetSimulationEntity[]):
            VC.Init()
            if(VCI:=VC.VoiceChat?):
                SimEntity.AddChatChannel(VCI)

    OnDebug(MAgent:?agent):void=
        if(SimEntity:=GetSimulationEntity[]):
            for(VC:SimEntity.GetVoiceChannels()):
                SimEntity.RemoveChatChannel(VC)
                Print("{Localize(VC.Name)}")

MyMemberInfo:=class(has_voice_member_info):

#MyChatChannel:=class(chat_channel(member_info_interface)):


trigger_event_handler:=class(basic_event_handler):
    @editable TriggerDevice:trigger_device = trigger_device{}
    GetSubscribe<override>()<transacts>:tuple(?listenable(?agent),?listenable(agent))=
        return (option. TriggerDevice.TriggeredEvent,_1:?listenable(agent)=false)

trigger_signal_handler:=class(basic_signal_handler):
    @editable Trigger:trigger_device = trigger_device{}
    Signal<override>(Agent:agent):void=
        Trigger.Trigger(Agent)


button_event_handler:=class(basic_event_handler):
    @editable ButtonDevice:button_device = button_device{}
    GetSubscribe<override>()<transacts>:tuple(?listenable(?agent),?listenable(agent))=
        return (_1:?listenable(?agent)=false,option. ButtonDevice.InteractedWithEvent)


channel_device_event_handler:=class(basic_event_handler):
    @editable ChannelDevice:channel_device = channel_device{}
    GetSubscribe<override>()<transacts>:tuple(?listenable(?agent),?listenable(agent))=
        return (option. ChannelDevice.ReceivedTransmitEvent,_1:?listenable(agent)=false)


mutator_zone_enum:=enum{OnEnter,OnExit}
mutator_zone_device_event_handler:=class(basic_event_handler):
    @editable MutatorZoneDevice:mutator_zone_device = mutator_zone_device{}
    @editable WhenToTrigger:mutator_zone_enum = mutator_zone_enum.OnEnter
    GetSubscribe<override>()<transacts>:tuple(?listenable(?agent),?listenable(agent))=
        case(WhenToTrigger):
            mutator_zone_enum.OnEnter=>return (_1:?listenable(?agent)=false,option. MutatorZoneDevice.AgentEntersEvent)
            mutator_zone_enum.OnExit=>return (_2:?listenable(?agent)=false,option. MutatorZoneDevice.AgentExitsEvent)

channel_signal_handler:=class(basic_signal_handler):
    @editable ChannelDevice:channel_device = channel_device{}
    Signal<override>(Agent:agent):void=
        ChannelDevice.Transmit(option. Agent)



basic_signal_handler:=class<abstract>:
    Signal(Agent:agent):void

basic_event_handler:=class<abstract>:
    GetSubscribe()<transacts>:tuple(?listenable(?agent),?listenable(agent))
