import { createMemoryHistory } from 'history'
import React from 'react'
import { Provider } from 'react-redux'
import { act, create } from 'react-test-renderer'
import configureStore from 'redux-mock-store'
import { ROUTE_CHANGED, Route, Router, createMiddleware } from 'redux-routable'
import { Link, Match, Routable } from './index'

const mockRouter = Router([
  Route('home', '/'),
  Route('search', '/search/:category?'),
])

const mockEvent = properties => ({
  defaultPrevented: false,
  button: 0,
  metaKey: false,
  altKey: false,
  ctrlKey: false,
  shiftKey: false,
  preventDefault: () => {},
  ...properties,
})

const mocks = ({ historyOptions, router = mockRouter } = {}) => {
  const history = createMemoryHistory(historyOptions)
  const middleware = createMiddleware(router, history)
  const store = configureStore([middleware])()

  // eslint-disable-next-line react/prop-types
  const Test = ({ children }) => (
    <Provider store={store}>
      <Routable router={router} history={history}>
        {children}
      </Routable>
    </Provider>
  )

  const make = element => {
    let renderer

    act(() => {
      renderer = create(<Test>{element}</Test>)
    })

    return { render: () => renderer.toJSON() }
  }

  const render = element => make(element).render()

  window.open = jest.fn()
  console.error = jest.fn()

  return { store, history, make, render }
}

describe('Match', () => {
  test('renders when matched on a single route', () => {
    const { render } = mocks()
    const match = render(<Match route="home">matched</Match>)

    expect(match).toBe('matched')
  })

  test('does not render when not matched on a single route', () => {
    const { render } = mocks()
    const match = render(<Match route="search">matched</Match>)

    expect(match).toBe(null)
  })

  test('renders when matched on multiple routes', () => {
    const { render } = mocks()
    const match = render(<Match route={['home', 'search']}>matched</Match>)

    expect(match).toBe('matched')
  })

  test('does not render when not matched on multiple routes', () => {
    const { render } = mocks()
    const match = render(<Match route={[]}>matched</Match>)

    expect(match).toBe(null)
  })

  test('renders correct content when location is changed', () => {
    const { history, make } = mocks()
    const matches = make(
      <React.Fragment>
        <Match route="home">home</Match>
        <Match route="search">search</Match>
      </React.Fragment>,
    )

    expect(matches.render()).toBe('home')
    act(() => history.replace('/search/widgets'))
    expect(matches.render()).toBe('search')
    act(() => history.replace('/'))
    expect(matches.render()).toBe('home')
  })

  test('does not render when location does not match a route', () => {
    const historyOptions = { initialEntries: ['/nonsense'] }
    const { history, make } = mocks({ historyOptions })
    const match = make(<Match route="home">matched</Match>)

    expect(match.render()).toBe(null)
    act(() => history.replace('/'))
    expect(match.render()).toBe('matched')
    act(() => history.replace('/nonsense'))
    expect(match.render()).toBe(null)
  })
})

describe('Link', () => {
  test('renders <a> element', () => {
    const { render } = mocks()
    const link = render(<Link route="home" />)

    expect(link.type).toBe('a')
  })

  test('generates correct href', () => {
    const { render } = mocks()
    const link = render(
      <Link
        route="search"
        params={{ category: 'widgets', query: 'devices' }}
        hash="#items"
      />,
    )

    expect(link.props.href).toBe('/search/widgets?query=devices#items')
  })

  test('allows other props to pass through', () => {
    const { render } = mocks()
    const link = render(<Link route="home" extra="extra" />)

    expect(link.props.extra).toBe('extra')
  })

  test('dispatches action when left-clicked', () => {
    const { store, render } = mocks()
    const link = render(<Link route="home" />)

    link.props.onClick(mockEvent())

    const [{ type, payload }] = store.getActions()

    expect(type).toBe(ROUTE_CHANGED)
    expect(payload).toEqual({ route: 'home', params: {}, hash: '' })
  })

  test('calls window.open() when left-clicked', () => {
    const { render } = mocks()
    const link = render(<Link route="home" action="open" />)

    link.props.onClick(mockEvent())

    expect(window.open).toHaveBeenCalledWith('/')
  })

  test('prevents default when left-clicked', () => {
    const { render } = mocks()
    const preventDefault = jest.fn()
    const link = render(<Link route="home" />)

    link.props.onClick(mockEvent({ preventDefault }))

    expect(preventDefault).toHaveBeenCalled()
  })

  test('does nothing when non-left-clicked', () => {
    const { store, render } = mocks()
    const link = render(<Link route="home" />)

    link.props.onClick(mockEvent({ defaultPrevented: true }))
    link.props.onClick(mockEvent({ button: 1 }))
    link.props.onClick(mockEvent({ metaKey: true }))
    link.props.onClick(mockEvent({ altKey: true }))
    link.props.onClick(mockEvent({ ctrlKey: true }))
    link.props.onClick(mockEvent({ shiftKey: true }))

    expect(store.getActions()).toEqual([])
  })

  test('calls onClick when clicked', () => {
    const { render } = mocks()
    const onClick = jest.fn()
    const event = mockEvent()
    const link = render(<Link route="home" onClick={onClick} />)

    link.props.onClick(event)

    expect(onClick).toHaveBeenCalledWith(event)
  })

  test('does not render and logs an error when route does not exist', () => {
    const { render } = mocks()
    const link = render(<Link route="nonsense" />)

    expect(link).toBe(null)
    expect(console.error).toHaveBeenCalled()
  })
})
