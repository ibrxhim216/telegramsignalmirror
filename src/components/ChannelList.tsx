import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { Hash, Users, Loader2, Settings } from 'lucide-react'
import clsx from 'clsx'
import ChannelConfigDialog from './ChannelConfigDialog'

interface ChannelListProps {
  isLoading: boolean
}

export default function ChannelList({ isLoading }: ChannelListProps) {
  const { channels, activeChannels, setActiveChannels } = useAppStore()
  const [configChannelId, setConfigChannelId] = useState<number | null>(null)
  const [configChannelName, setConfigChannelName] = useState<string>('')

  const toggleChannel = (channelId: number) => {
    console.log('Toggling channel:', channelId)
    if (activeChannels.includes(channelId)) {
      const newChannels = activeChannels.filter((id) => id !== channelId)
      console.log('Removing channel. New active channels:', newChannels)
      setActiveChannels(newChannels)
    } else {
      const newChannels = [...activeChannels, channelId]
      console.log('Adding channel. New active channels:', newChannels)
      setActiveChannels(newChannels)
    }
  }

  const openConfig = (e: React.MouseEvent, channelId: number, channelName: string) => {
    e.stopPropagation()
    setConfigChannelId(channelId)
    setConfigChannelName(channelName)
  }

  const closeConfig = () => {
    setConfigChannelId(null)
    setConfigChannelName('')
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  if (channels.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-gray-400 text-center text-sm">
          No channels found. Make sure you're a member of Telegram channels or groups.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        {channels.map((channel) => {
          const isActive = activeChannels.includes(channel.id)

          return (
            <div
              key={channel.id}
              onClick={() => toggleChannel(channel.id)}
              className={clsx(
                'p-4 border-b border-gray-700 cursor-pointer transition-colors',
                isActive ? 'bg-blue-600/10 border-l-4 border-l-blue-500' : 'hover:bg-gray-700/50'
              )}
            >
              <div className="flex items-start gap-3">
                <div className={clsx(
                  'p-2 rounded-lg',
                  channel.type === 'channel' ? 'bg-blue-500/10' : 'bg-green-500/10'
                )}>
                  {channel.type === 'channel' ? (
                    <Hash className="text-blue-400" size={20} />
                  ) : (
                    <Users className="text-green-400" size={20} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-white truncate">{channel.title}</h3>
                  {channel.username && (
                    <p className="text-xs text-gray-400 truncate">@{channel.username}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500 capitalize">{channel.type}</span>
                    {isActive && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={(e) => openConfig(e, channel.id, channel.title)}
                  className="p-2 hover:bg-gray-600 rounded-lg transition-colors"
                  title="Configure channel keywords"
                >
                  <Settings className="text-gray-400 hover:text-white" size={18} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {configChannelId && (
        <ChannelConfigDialog
          channelId={configChannelId}
          channelName={configChannelName}
          isOpen={true}
          onClose={closeConfig}
        />
      )}
    </>
  )
}
