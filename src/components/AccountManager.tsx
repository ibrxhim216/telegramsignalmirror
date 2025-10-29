import { useState, useEffect } from 'react'
import { Plus, Trash2, Check, X } from 'lucide-react'

interface TradingAccount {
  id: number
  platform: string
  account_number: string
  account_name: string | null
  is_active: number
  created_at: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export default function AccountManager({ isOpen, onClose }: Props) {
  const [accounts, setAccounts] = useState<TradingAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newAccount, setNewAccount] = useState({
    platform: 'MT5',
    accountNumber: '',
    accountName: ''
  })

  useEffect(() => {
    if (isOpen) {
      loadAccounts()
    }
  }, [isOpen])

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const result = await window.electron.account.getAll()
      if (result.success) {
        setAccounts(result.accounts)
      }
    } catch (error) {
      console.error('Error loading accounts:', error)
    }
    setLoading(false)
  }

  const handleAddAccount = async () => {
    if (!newAccount.accountNumber) {
      alert('Please enter an account number')
      return
    }

    try {
      const result = await window.electron.account.add({
        platform: newAccount.platform,
        accountNumber: newAccount.accountNumber,
        accountName: newAccount.accountName || `${newAccount.platform} Account`
      })

      if (result.success) {
        alert('Account added successfully!')
        setShowAddForm(false)
        setNewAccount({ platform: 'MT5', accountNumber: '', accountName: '' })
        loadAccounts()
      } else {
        alert('Failed to add account: ' + result.error)
      }
    } catch (error: any) {
      alert('Error: ' + error.message)
    }
  }

  const handleToggleActive = async (id: number, isActive: boolean) => {
    try {
      const result = await window.electron.account.setActive(id, !isActive)
      if (result.success) {
        loadAccounts()
      }
    } catch (error) {
      console.error('Error toggling account:', error)
    }
  }

  const handleDeleteAccount = async (id: number) => {
    if (!confirm('Are you sure you want to delete this account?')) return

    try {
      const result = await window.electron.account.delete(id)
      if (result.success) {
        loadAccounts()
      }
    } catch (error) {
      console.error('Error deleting account:', error)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Trading Accounts</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="text-center text-gray-400 py-8">Loading accounts...</div>
          ) : (
            <>
              {/* Accounts List */}
              <div className="space-y-3 mb-6">
                {accounts.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    No accounts configured. Add your MT5 account to receive signals.
                  </div>
                ) : (
                  accounts.map(account => (
                    <div
                      key={account.id}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        account.is_active
                          ? 'bg-green-500/10 border-green-500'
                          : 'bg-gray-700 border-gray-600'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{account.account_number}</span>
                          <span className="px-2 py-0.5 text-xs rounded bg-blue-500/20 text-blue-400">
                            {account.platform}
                          </span>
                          {account.is_active && (
                            <span className="px-2 py-0.5 text-xs rounded bg-green-500/20 text-green-400">
                              Active
                            </span>
                          )}
                        </div>
                        {account.account_name && (
                          <p className="text-sm text-gray-400 mt-1">{account.account_name}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(account.id, account.is_active === 1)}
                          className={`p-2 rounded transition-colors ${
                            account.is_active
                              ? 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                              : 'bg-green-600 hover:bg-green-700 text-white'
                          }`}
                          title={account.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {account.is_active ? <X size={16} /> : <Check size={16} />}
                        </button>
                        <button
                          onClick={() => handleDeleteAccount(account.id)}
                          className="p-2 bg-red-600 hover:bg-red-700 rounded transition-colors text-white"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add Account Form */}
              {showAddForm ? (
                <div className="border border-gray-600 rounded-lg p-4 bg-gray-700/50">
                  <h3 className="text-sm font-semibold text-white mb-3">Add New Account</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Platform</label>
                      <select
                        value={newAccount.platform}
                        onChange={(e) => setNewAccount({ ...newAccount, platform: e.target.value })}
                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm text-white"
                      >
                        <option value="MT4">MT4</option>
                        <option value="MT5">MT5</option>
                        <option value="cTrader">cTrader</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Account Number *</label>
                      <input
                        type="text"
                        value={newAccount.accountNumber}
                        onChange={(e) => setNewAccount({ ...newAccount, accountNumber: e.target.value })}
                        placeholder="Enter account number (e.g., 52555244)"
                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm text-white placeholder-gray-400"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Account Name (Optional)</label>
                      <input
                        type="text"
                        value={newAccount.accountName}
                        onChange={(e) => setNewAccount({ ...newAccount, accountName: e.target.value })}
                        placeholder="My Trading Account"
                        className="w-full bg-gray-600 border border-gray-500 rounded px-3 py-2 text-sm text-white placeholder-gray-400"
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleAddAccount}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded transition-colors font-medium"
                      >
                        Add Account
                      </button>
                      <button
                        onClick={() => setShowAddForm(false)}
                        className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-600 hover:border-green-500 rounded-lg text-gray-400 hover:text-green-500 transition-colors"
                >
                  <Plus size={20} />
                  <span>Add Trading Account</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
