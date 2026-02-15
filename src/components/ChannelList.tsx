import { useState, useMemo } from 'react'
import { useAppStore } from '../store/appStore'
import { Hash, Users, Loader2, Settings, Search, X } from 'lucide-react'
import clsx from 'clsx'
import ChannelConfigDialog from './ChannelConfigDialog'

interface ChannelListProps {
  isLoading: boolean
}

export default function ChannelList({ isLoading }: ChannelListProps) {
  const { channels, activeChannels, setActiveChannels } = useAppStore()
  const [configChannelId, setConfigChannelId] = useState<number | null>(null)
  const [configChannelName, setConfigChannelName] = useState<string>('')
  const [configChannelIsActive, setConfigChannelIsActive] = useState<boolean>(false)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filterType, setFilterType] = useState<'all' | 'channel' | 'group'>('all')

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

  // Filter and search channels
  const filteredChannels = useMemo(() => {
    return channels.filter(channel => {
      // Apply type filter
      if (filterType !== 'all' && channel.type !== filterType) {
        return false
      }

      // Apply search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        const titleMatch = channel.title.toLowerCase().includes(search)
        const usernameMatch = channel.username?.toLowerCase().includes(search)
        return titleMatch || usernameMatch
      }

      return true
    })
  }, [channels, searchTerm, filterType])

  const openConfig = (e: React.MouseEvent, channelId: number, channelName: string) => {
    e.stopPropagation()
    const isActive = activeChannels.includes(channelId)
    setConfigChannelId(channelId)
    setConfigChannelName(channelName)
    setConfigChannelIsActive(isActive)
  }

  const closeConfig = () => {
    setConfigChannelId(null)
    setConfigChannelName('')
    setConfigChannelIsActive(false)
  }

  const clearSearch = () => {
    setSearchTerm('')
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
      {/* Search and Filter Bar */}
      <div className="p-3 border-b border-gray-700 space-y-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search channels..."
            className="w-full bg-gray-700/50 text-white pl-10 pr-10 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Type Filter Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={clsx(
              'flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filterType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
            )}
          >
            All ({channels.length})
          </button>
          <button
            onClick={() => setFilterType('channel')}
            className={clsx(
              'flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filterType === 'channel'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
            )}
          >
            Channels ({channels.filter(c => c.type === 'channel').length})
          </button>
          <button
            onClick={() => setFilterType('group')}
            className={clsx(
              'flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              filterType === 'group'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
            )}
          >
            Groups ({channels.filter(c => c.type === 'group').length})
          </button>
        </div>

        {/* Results Count */}
        {searchTerm && (
          <p className="text-xs text-gray-400">
            {filteredChannels.length} result{filteredChannels.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredChannels.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <p className="text-gray-400 text-center text-sm">
              No channels match your search.
            </p>
          </div>
        ) : (
          filteredChannels.map((channel) => {
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
        })
        )}
      </div>

      {configChannelId && (
        <ChannelConfigDialog
          channelId={configChannelId}
          channelName={configChannelName}
          isOpen={true}
          isMonitoring={configChannelIsActive}
          onClose={closeConfig}
        />
      )}
    </>
  )
}
