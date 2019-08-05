import PropTypes from 'prop-types'
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { useDispatch } from 'react-redux'
import {
  LocationMatchError,
  RouteMatchError,
  Router,
  locationToRoute,
  open,
  push,
  replace,
  routeToLocation,
} from 'redux-routable'

const HistoryContext = createContext()
const RouterContext = createContext()
const CurrentRouteContext = createContext()

// Routable Component
export const Routable = ({ router, history, children }) => {
  const [currentRoute, setCurrentRoute] = useState(() => {
    try {
      return locationToRoute(router, history.location).route
    } catch (error) {
      if (error instanceof LocationMatchError) {
        return null
      } else {
        throw error
      }
    }
  })

  useEffect(() => {
    return history.listen(location => {
      try {
        setCurrentRoute(locationToRoute(router, location).route)
      } catch (error) {
        if (error instanceof LocationMatchError) {
          setCurrentRoute(null)
        } else {
          throw error
        }
      }
    })
  }, [router, history, setCurrentRoute])

  return (
    <HistoryContext.Provider value={history}>
      <RouterContext.Provider value={router}>
        <CurrentRouteContext.Provider value={currentRoute}>
          {children}
        </CurrentRouteContext.Provider>
      </RouterContext.Provider>
    </HistoryContext.Provider>
  )
}

Routable.propTypes = {
  router: PropTypes.instanceOf(Router).isRequired,
  history: PropTypes.object.isRequired,
  children: PropTypes.node.isRequired,
}

// Match Component
export const Match = ({ route, children }) => {
  const currentRoute = useContext(CurrentRouteContext)

  if (currentRoute === null) {
    return null
  }

  const routes = route instanceof Array ? route : [route]
  const match = routes.includes(currentRoute.name)

  return match ? children : null
}

Match.propTypes = {
  route: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.arrayOf(PropTypes.string),
  ]).isRequired,
  children: PropTypes.node.isRequired,
}

// Link Component
const linkActionCreators = { push, replace, open }

const isModifiedEvent = event =>
  event.metaKey || event.altKey || event.ctrlKey || event.shiftKey

export const Link = ({ action, route, params, hash, onClick, ...props }) => {
  const dispatch = useDispatch()
  const history = useContext(HistoryContext)
  const router = useContext(RouterContext)
  let location

  try {
    location = routeToLocation(router, route, params, hash)
  } catch (error) {
    if (error instanceof RouteMatchError) {
      console.error(error)
      return null
    } else {
      throw error
    }
  }

  const href = history.createHref(location)
  const target = props.target || '_self'

  const handleClick = useCallback(
    event => {
      if (onClick) onClick(event)

      if (
        !event.defaultPrevented &&
        event.button === 0 &&
        target === '_self' &&
        !isModifiedEvent(event)
      ) {
        const actionCreator = linkActionCreators[action]
        const linkAction = actionCreator(route, params, hash)

        event.preventDefault()
        dispatch(linkAction)
      }
    },
    [onClick, target, action, route, params, hash, dispatch],
  )

  return <a {...props} href={href} onClick={handleClick} />
}

Link.propTypes = {
  action: PropTypes.oneOf(['push', 'replace', 'open']),
  route: PropTypes.string.isRequired,
  params: PropTypes.objectOf(PropTypes.string),
  hash: PropTypes.string,
  target: PropTypes.string,
  onClick: PropTypes.func,
}

Link.defaultProps = {
  action: 'push',
  params: {},
  hash: '',
}
